+++
date = "2013-05-29"
metadescription = "In the final post of the Risk Analyzer series we tie up our go web applications loose ends using golang, MongoDB, and AJAX. Tying it all together."
metatitle = "jkallhoff.com | go web apps risk analyzer tying it all together"
series = ["archive","risk analyzer"]
tags = ["go"]
title = "Go Web Apps: Risk Analyzer - Tying It All Together"

+++

If you haven't read the previous Risk Analyzer posts I highly suggest you do so first:

*   [GO WEB APPS: RISK ANALYZER – SETUP][1]
*   [GO WEB APPS: RISK ANALYZER – ENGINE AND TESTS][2]

# Overview

For this final post in the series we're going to be tying all of our loose ends together. By the end we should have:

*   Full MongoDB persistence of previously calculated battle results
*   A new web application HTTP endpoint that returns the results of a particular calculator request
*   Javascript that makes the AJAX call to our new endpoint

We'll also do some code cleanup to make sure we're handling all possible **error** conditions. I've seen too many people yelled at online for getting around error handling by throwing the errors into the **_** ignored space.

# MongoDB Integration

This section assumes that you have a working MongoDB database and that you have full access to it. For those of you who are new to MongoDB it's a schema-less document database developed and maintained by [10Gen][3]. The [MongoDB Docs][4] are an excellent mostly up-to-date resource if you're looking to learn more.

I've set up my own MongoDB instance using my [WebFaction][5] account using the steps I've outlined here:

*   [SETTING UP MONGODB ON WEBFACTION WITH GOLANG][6]

A couple MongoDB specific hosts with free sandbox accounts:

*   [MongoLab][7]
*   [MongoHQ][8]

Even if you're not going to use WebFaction I'd highly suggest you read my [MongoDB][6] post. It discusses using the **[mgo][9]** MongoDB Go package which is handy even if you're not using WebFaction for hosting. Right then, lets get started.

## mongoRepo.go

If you're following along with the previous posts now's the time to add a new Go file to your project root: **mongoRepo.go**. I'll be breaking down the file section by section. If you're in a hurry you can see the full source at the end of the post as well as at the [GitHub repo][10].

### Imports

{{< highlight go >}}
package main

import (
    "fmt"
    "github.com/JKallhoff/gofig"
    "github.com/JKallhoff/risk-analyzer-web/riskEngine"
    "labix.org/v2/mgo"
    "labix.org/v2/mgo/bson"
)
{{< /highlight >}}

These should be pretty straightforward. We're including the **mongoRepo.go** code as part of the **main** package and importing the following package dependencies:

*   **fmt** - used for string formatting
*   **github.com/JKallhoff/gofig** - used for managing our applications environment config values
*   **github.com/JKallhoff/risk-analyzer-web/riskEngine** - we're adding a dependency on our battle engine so we can use the package's exported types.
*   **labix.org/v2/mgo** - the Go MongoDB driver package
*   **labix.org/v2/mgo/bson** - the driver package's companion for bson document representation/functions

### Global Vars

{{< highlight go >}}
var (
    session    mgo.Session
    collection *mgo.Collection
) 
{{< /highlight >}}

Here we've created variables for a MongoDB session and collection. We'll use these to both close the connection when the application is complete as well as reference our results collection from various repo methods.

### The BattleRepository Interface

{{< highlight go >}}
type battleRepository interface {
    SaveBattleResult(*riskEngine.BattleResult) error
    FetchBattleResult(attackingArmies, defendingArmies int) (*riskEngine.BattleResult, error)
    Close()
}
{{< /highlight >}}

I knew before I started writing the repository that I wanted to make sure and loosely couple my concrete MongoDB implementation code to my web application for testing purposes. In order to do this I needed to create an interface that described the repository *contract* to any calling code. Here we've created an interface that requires three functions to be implemented:

*   **SaveBattleResult** takes in a pointer to a **riskEngine.BattleResult** and optionally returns an **error** if necessary
*   **FetchBattleResult** takes in the requested attacking armies and defending armies, returning both a pointer to a **riskEngine.BattleResult** and an optional **error**
*   **Close** is meant to close any open connections, if necessary

### The mongoRepository Implementation of BattleRepository

Finally we start digging into our actual MongoDB code starting with the type declaration:

{{< highlight go >}}
type mongoRepository struct {
}
{{< /highlight >}}

Not much to see here eh? First we implement the close method so any calling code can close our MongoDB session when needed:

{{< highlight go >}}
func (*mongoRepository) Close() {
    session.Close()
}
{{< /highlight >}}

Now we implement the **SaveBattleResult** method:

{{< highlight go >}}
func (*mongoRepository) SaveBattleResult(result *riskEngine.BattleResult) (err error) {
    err = collection.Insert(result)
    return
}
{{< /highlight >}}

Notice how clean that looks? MongoDB being a document data store really simplifies the storage process. Because it's schema-less/non-column based Mongo is able to take our structs as they're defined, convert them to BSON, and store them as is. There's no need to *map* our struct's properties to pre-defined columns.

{{< highlight go >}}
func (*mongoRepository) FetchBattleResult(attackingArmies, defendingArmies int) (*riskEngine.BattleResult, error) {
    result := riskEngine.BattleResult{}
    var err error

    if err = collection.Find(bson.M{"AttackingArmies": attackingArmies, "DefendingArmies": defendingArmies}).One(&result); err != nil {
        return nil, err
    }
    return &result, nil
}
{{< /highlight >}}

Here's our **FetchBattleResult** implementation. It takes in our attacking and defending army numbers and attempts to fetch a record out of the data store that matches them. If a result is found we return a pointer to it and set **err** to **nil** before returning. However, if a match isn't found we instead return **nil** for the found document and a corresponding **error** object.

To save on performance it's ideal that we only need to open one session to the database upon program execution. Lets add an **init** function to our repository that will be called on load that instantiates our session object and loads our collection pointer into our pre-defined global var:

{{< highlight go >}}
func init() {
    session, err := mgo.Dial(fmt.Sprintf("%s:%s@localhost:%s", gofig.Str("mongoUsername"), gofig.Str("mongoPassword"), gofig.Str("mongoPort")))
    if err != nil {
        panic(err)
    }
    session.SetMode(mgo.Monotonic, true)
    collection = session.DB("risk").C("battleResults")
}
{{< /highlight >}}

Notice how we're using both the **fmt** package as well as **GoFig** to load our connection string values from our **gofig.json** file and format the connection string before dialing our database. You'll need to make sure your **gofig.json** file includes the following values in order for this to work:

{{< highlight json >}}
{
    "webPort": ":<Your web application port>",
    "mongoUsername":"<Your MongoDB username>",
    "mongoPassword":"<Your MongoDB password>",
    "mongoPort": "<The port MongoDB is running on>"
}
{{< /highlight >}}

# Updating the Web Application to Calculate Battle Results

We're going to be making a handful of changes to our **app.go** file to support making POSTS to the newly defined calculator endpoint. In summary we'll:

*   Declare a new function type that we'll use to inject our **battleRepository** instance
*   Write the **ServeHTTP** method for that new type so we can use it as a handler in our route config
*   Add a new endpoint declaration to our route config
*   Finally, add the route handler method itself

Let's start by declaring our new function type:

{{< highlight go >}}
type dependencyHandler func(w http.ResponseWriter, r *http.Request, repo battleRepository)
{{< /highlight >}}

**dependencyHandler** is a func type that takes in an object that implements the **battleRepository** interface in addition to the **http.ResponseWrite** and ***http.Request** objects. In order for us to be able to use this as a handler in our route config it needs to implement the **Handler** interface defined [here][11]. Let's implement that now:

{{< highlight go >}}
func (d dependencyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    repo := new(mongoRepository)
    d(w, r, repo)
    defer repo.Close()
    return
}
{{< /highlight >}}

In the above **ServeHTTP** declaration we're instantiating a new instance of our concrete **mongoRepository** struct, passing it into a call to the underlying **dependencyHandler** as the **repo** value, making sure to call the repo's **Close()** method deferred, and finally returning. This, in a nutshell, is how we'll loosely couple our concrete **mongoRepository** to our new endpoint declared below.

Now that we have all of the plumbing in place, lets add our actual new handler functions:

{{< highlight go >}}
func battleRequestHandler(w http.ResponseWriter, r *http.Request, repo battleRepository) {
    var result *riskEngine.BattleResult
    var attackingArmies, defendingArmies int
    var err error

    if attackingArmies, err = strconv.Atoi(r.FormValue("attackingArmies")); err != nil {
        http.Error(w, "Invalid battle request detected", http.StatusInternalServerError)
        return
    }
    if defendingArmies, err = strconv.Atoi(r.FormValue("defendingArmies")); err != nil {
        http.Error(w, "Invalid battle request detected", http.StatusInternalServerError)
        return
    }

    if result, err = repo.FetchBattleResult(attackingArmies, defendingArmies); err != nil && err.Error() != "not found" {
        http.Error(w, "There was an error fetching the existing results", http.StatusInternalServerError)
        return
    }

    if result == nil {
        battleRequest := &riskEngine.BattleRequest{AttackingArmies: attackingArmies, DefendingArmies: defendingArmies, NumberOfBattles: 10000}
        result = battleRequest.CalculateBattleResults()
        if err = repo.SaveBattleResult(result); err != nil {
            http.Error(w, "There was an error saving the new results", http.StatusInternalServerError)
            return
        }
    }

    if returnData, err := json.Marshal(result); err != nil {
        http.Error(w, "There was an error with your request. Please try again", http.StatusInternalServerError)
        return
    } else {
        w.Write(returnData)
    }

    return
}
{{< /highlight >}}

There are a number of fun things happening in this method. The general logic flow is:

*   Verify that the attacking armies count was passed in the POST and that it can be converted to an integer.
*   Verify that the defending armies count was passed in the POST and that it can be converted to an integer.
*   Try pulling an existing record from the **battleRepository**. If a record doesn't exist: 
    *   Form up a **riskEngine.battleRequest** and call its **CalculateBattleResults()** function.
    *   Persist the result in our **battleRepository** for future requests using that unique attacking/defending armies combination.
*   Return the results as JSON.

Values posted via an HTTP POST request can be retrieved from the ***http.Request** object's **FormValue("id")** method. Here you can see that we're pulling both **attackingArmies** and **defendingArmies** using this method. We also attempt to convert each to an integer using the **strconv** package's **Atoi** method, capturing and returning if we encounter any conversion errors.

Next up we make a call to the **battleRepository**'s **FetchBattleResult** method, passing in our attacking armies and defending armies. The error handling here is a little odd because the underlying Mongo driver code returns an **error** if the document isn't found. Normally this makes sense but in our case we want processing to continue if the **error** is due to a missing document; however, we don't want to continue if the **error** happens for any other reason. Thus we're sniffing out the contents of the **error** and continuing if that contents equals "not found".

In the following code we check to see if our object was found and, if not, make a call to our underlying risk engine, capturing the results in a ***riskEngine.BattleResult** object and promptly persisting it with our repo. Finally, we use the **encoding/json** package to attempt to convert our *\*\*|||||||||||||riskEngine.BattleResult\** object to a JSON string using the **json.Marshall()** function. If there's an error during the Marshalling processes we return it otherwise we return the marshalled JSON.

Now the only thing left in the **app.go** code is to add the actual route handler:

{{< highlight go >}}
router.Handle("/BattleRequest", dependencyHandler(battleRequestHandler)).Methods("POST")
{{< /highlight >}}

# Updated HTML

I had to update the **/static/view/home.html** file a bit to support the Javascript hooks I needed to make my AJAX calls and update the UI. I've pasted the HTML in its entirety here; you should be able to just copy and paste it:

{{< highlight html >}}
<!DOCTYPE html>
<html>
    <head>
        <title>Risk Dominator</title>
        <link href="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.1/css/bootstrap-combined.min.css" rel="stylesheet" />
        <link href="/static/styles/risk.css" rel="stylesheet" />
    </head>
    <body>
        <div class="container">
            <div class="row">
                <div class="page-header">
                  <h1>Risk Analyzer <small>Dominating board game tables everywhere!</small></h1>
                </div>
            </div>
            <div class="row">
                <div class="span3">
                    <form method="post" action="/BattleRequest">
                        <fieldset>
                            <label for="attackingArmies">Attackers</label>
                            <input type="text" name="attackingArmies" id="attackingArmies" />
                            <label for="defendingArmies">Defenders</label>
                            <input type="text" name="defendingArmies" id="defendingArmies" />
                            <p>
                                <input type="submit" class="btn btn-primary btn-large" value="Roll the Dice!" />
                            </p>
                        </fieldset>
                    </form>
                </div>
                <div class="span4" style="display:none" id="resultsContainer">
                    <div id="loadingAnimation">
                        <img src="/static/images/dice.gif" alt="rolling dice" />
                    </div>
                    <div id="result" class="well">
                        <h2>Percentage of Battles Won: <span id="percentage"></span></h2>
                        <h3>Avg. Attackers Left: <span id="avgLeft"></span></h3>
                    </div>
                </div>
            </div>
        </div>
        <script src="http://code.jquery.com/jquery-1.9.1.min.js"></script>
        <script src="/static/scripts/risk.js"></script>
        <script src="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.1/js/bootstrap.min.js"></script>
    </body>
</html>
{{< /highlight >}}

# And Finally, the Javascript

Since this series is more about Go and less about my admittedly bad Javascript I'll also just paste the script I came up with. Replace the contents of **/static/scripts/risk.js** with the following:

{{< highlight js >}}
$( document ).ready(function() {
    $(".btn").click(function(e){
        e.preventDefault();
        battleRequester.showRollingAnimation();
        battleRequester.submitRequest(battleRequester.showResults);
        return false;
    })
});

var battleRequester = {
    attackingArmies: $("#attackingArmies"),
    defendingArmies: $("#defendingArmies"),

    showRollingAnimation: function(){
        $("#resultsContainer").show();
        $("#result").hide();
        $("#loadingAnimation").show();
    },

    showResults: function(){
        $("#resultsContainer").show();
        $("#loadingAnimation").hide();
        $("#result").show();
    },

    submitRequest: function(handler){
    var values = {
        attackingArmies: this.attackingArmies.val(),
        defendingArmies: this.defendingArmies.val()
    };
    $.ajax({
          url: "/BattleRequest",
          type: "POST",
          dataType: "json",
          data: values,
          success: function(response){
            $("#percentage").html(response.PercentageThatWereWins);
            $("#avgLeft").html(response.AverageNumberOfAttackersLeft);
            handler();
          }
        });
    }
}
{{< /highlight >}}

Not a lot going on here: we're binding a click event handler to our button to call our new **/BattleRequest** endpoint, sending in our attacking/defending army totals, and updating the UI with the response. The UI isn't meant to be pretty, purely functional. It's all about the Go!

# Tying It All Together

We should now have a fully working web application that achieves the goals we set out in our [first post][1]. We wrote a battle calculator package that calculates not only the percentage of battles won by the attacker given particular attacker/defender army count numbers but also the average number of attackers left. We created a super simple light weight web application in Go to serve our markup and make calls to our calculator, rendering the results. We tied in data persistence using MongoDB and even wrote some unit tests for good measure.

The latest source can be found here:

<https://github.com/JKallhoff/risk-analyzer-web>

By the end of the project our working project tree looked like:

*   app.go
*   gofig.json
*   mongoRepo.go
*   riskEngine 
    *   battleCalculator.go
    *   battleCalculator_test.go
*   static 
    *   images 
        *   dice.gif
    *   scripts 
        *   risk.js
    *   styles 
        *   risk.css
    *   views 
        *   home.html

## app.go

{{< highlight go >}}
package main

import (
    "encoding/json"
    "github.com/JKallhoff/gofig"
    "github.com/JKallhoff/risk-analyzer-web/riskEngine"
    "github.com/gorilla/mux"
    "net/http"
    "strconv"
)

func main() {
    router := mux.NewRouter()
    router.HandleFunc("/", homeHandler).Methods("GET")
    router.Handle("/BattleRequest", dependencyHandler(battleRequestHandler)).Methods("POST")

    http.Handle("/", router)
    http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, r.URL.Path[1:])
    })

    panic(http.ListenAndServe(gofig.Str("webPort"), nil))
}

type dependencyHandler func(w http.ResponseWriter, r *http.Request, repo battleRepository)

func (d dependencyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    repo := new(mongoRepository)
    d(w, r, repo)
    defer repo.Close()
    return
}

func battleRequestHandler(w http.ResponseWriter, r *http.Request, repo battleRepository) {
    var result *riskEngine.BattleResult
    var attackingArmies, defendingArmies int
    var err error

    if attackingArmies, err = strconv.Atoi(r.FormValue("attackingArmies")); err != nil {
        http.Error(w, "Invalid battle request detected", http.StatusInternalServerError)
        return
    }
    if defendingArmies, err = strconv.Atoi(r.FormValue("defendingArmies")); err != nil {
        http.Error(w, "Invalid battle request detected", http.StatusInternalServerError)
        return
    }

    if result, err = repo.FetchBattleResult(attackingArmies, defendingArmies); err != nil && err.Error() != "not found" {
        http.Error(w, "There was an error fetching the existing results", http.StatusInternalServerError)
        return
    }

    if result == nil {
        battleRequest := &riskEngine.BattleRequest{AttackingArmies: attackingArmies, DefendingArmies: defendingArmies, NumberOfBattles: 10000}
        result = battleRequest.CalculateBattleResults()
        if err = repo.SaveBattleResult(result); err != nil {
            http.Error(w, "There was an error saving the new results", http.StatusInternalServerError)
            return
        }
    }

    if returnData, err := json.Marshal(result); err != nil {
        http.Error(w, "There was an error with your request. Please try again", http.StatusInternalServerError)
        return
    } else {
        w.Write(returnData)
    }

    return
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "static/views/home.html")
    return
}
{{< /highlight >}}

## mongoRepo.go

{{< highlight go >}}
package main

import (
    "fmt"
    "github.com/JKallhoff/gofig"
    "github.com/JKallhoff/risk-analyzer-web/riskEngine"
    "labix.org/v2/mgo"
    "labix.org/v2/mgo/bson"
)

var (
    session    mgo.Session
    collection *mgo.Collection
)

type battleRepository interface {
    SaveBattleResult(*riskEngine.BattleResult) error
    FetchBattleResult(attackingArmies, defendingArmies int) (*riskEngine.BattleResult, error)
    Close()
}

type mongoRepository struct {
}

func (*mongoRepository) Close() {
    session.Close()
}

func (*mongoRepository) SaveBattleResult(result *riskEngine.BattleResult) (err error) {
    err = collection.Insert(result)
    return
}

func (*mongoRepository) FetchBattleResult(attackingArmies, defendingArmies int) (*riskEngine.BattleResult, error) {
    result := riskEngine.BattleResult{}
    var err error

    if err = collection.Find(bson.M{"AttackingArmies": attackingArmies, "DefendingArmies": defendingArmies}).One(&result); err != nil {
        return nil, err
    }
    return &result, nil
}

func init() {
    session, err := mgo.Dial(fmt.Sprintf("%s:%s@localhost:%s", gofig.Str("mongoUsername"), gofig.Str("mongoPassword"), gofig.Str("mongoPort")))
    if err != nil {
        panic(err)
    }
    session.SetMode(mgo.Monotonic, true)
    collection = session.DB("risk").C("battleResults")
}
{{< /highlight >}}

## riskEngine/battleCalculator.go

{{< highlight go >}}
package riskEngine

import (
    "math/rand"
    "sort"
    "time"
)

type BattleCalculator interface {
    CalculateBattleResults() *BattleResult
}

type BattleResult struct {
    AttackingArmies              int     "AttackingArmies"
    DefendingArmies              int     "DefendingArmies"
    AverageNumberOfAttackersLeft int     "AverageNumberOfAttackersLeft"
    PercentageThatWereWins       float32 "PercentageThatWereWins"
}

type BattleRequest struct {
    AttackingArmies, DefendingArmies int
    NumberOfBattles                  int
    singleBattleResolver             func(*BattleRequest) *singleBattleResult
    diceRoller                       func(numberOfDiceToRoll int) []int
}

type singleBattleResult struct {
    AttackingArmiesLeft int
    AttackerWon         bool
}

func (request *BattleRequest) CalculateBattleResults() (result *BattleResult) {

    rand.Seed(time.Now().UnixNano())
    battles := make([]*singleBattleResult, request.NumberOfBattles, request.NumberOfBattles)

    if request.singleBattleResolver == nil {
        request.singleBattleResolver = determineSingleBattle
    }

    if request.diceRoller == nil {
        request.diceRoller = rollTheDice
    }

    for index, _ := range battles {
        battles[index] = request.singleBattleResolver(request)
    }

    result = request.calculateBattleResult(battles)
    result.AttackingArmies = request.AttackingArmies
    result.DefendingArmies = request.DefendingArmies
    return
}

type diceResultSorter struct {
    sort.Interface
}

func (sorter diceResultSorter) Less(i, j int) bool {
    return sorter.Interface.Less(j, i)
}

func rollTheDice(numberOfDiceToRoll int) (results []int) {
    results = make([]int, numberOfDiceToRoll)
    for index, _ := range results {
        results[index] = rand.Intn(6) + 1
    }
    sort.Sort(diceResultSorter{sort.IntSlice(results)})
    return
}

func (request *BattleRequest) calculateBattleResult(battles []*singleBattleResult) (result *BattleResult) {
    result = new(BattleResult)
    sum := 0
    numberOfBattles := 0
    numberOfWins := 0

    for _, battleResult := range battles {
        sum = sum + battleResult.AttackingArmiesLeft
        numberOfBattles++
        if battleResult.AttackerWon {
            numberOfWins++
        }
    }

    result.AverageNumberOfAttackersLeft = int(sum / numberOfBattles)
    result.PercentageThatWereWins = (float32(numberOfWins) / float32(numberOfBattles)) * 100
    return
}

func determineSingleBattle(request *BattleRequest) (result *singleBattleResult) {
    var (
        remainingAttackers = request.AttackingArmies
        remainingDefenders = request.DefendingArmies
        numberOfDice       int
    )

    for remainingAttackers > 1 && remainingDefenders > 0 {
        if remainingAttackers > 4 {
            numberOfDice = 3
        } else {
            numberOfDice = remainingAttackers - 1
        }

        attackingDice := request.diceRoller(numberOfDice)

        if remainingDefenders >= 2 {
            numberOfDice = 2
        } else {
            numberOfDice = 1
        }

        defendingDice := request.diceRoller(numberOfDice)

        if attackingDice[0] > defendingDice[0] {
            remainingDefenders--
        } else {
            remainingAttackers--
        }

        if len(attackingDice) > 1 && len(defendingDice) > 1 {
            if attackingDice[1] > defendingDice[1] {
                remainingDefenders--
            } else {
                remainingAttackers--
            }
        }
    }

    result = new(singleBattleResult)
    result.AttackingArmiesLeft = remainingAttackers

    if remainingDefenders > 0 {
        result.AttackerWon = false
    } else {
        result.AttackerWon = true
    }
    return
}
{{< /highlight >}}

 [1]: http://jessekallhoff.com/2013/05/02/go-web-apps-risk-analyzer-pt-1/
 [2]: http://jessekallhoff.com/2013/05/13/go-web-apps-risk-analyzer-engine-and-tests-pt-2/
 [3]: http://www.10gen.com/
 [4]: http://docs.mongodb.org/manual/
 [5]: http://www.webbfaction.com
 [6]: http://jessekallhoff.com/2013/04/10/setting-up-mongodb-on-webfaction-with-golang/
 [7]: http://mongolab.com
 [8]: http://www.mongohq.com
 [9]: http://labix.org/mgo
 [10]: https://github.com/JKallhoff/risk-analyzer-web/blob/master/mongoRepo.go
 [11]: http://golang.org/pkg/net/http/#Handler