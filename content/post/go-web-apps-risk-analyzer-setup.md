+++
date = "2013-05-02"
metadescription = "Go Web Apps: The first post in a series on building a go (golang) web application from scratch."
metatitle = "jessekallhoff.com | go web apps risk analyzer setup"
series = ["archive","risk analyzer"]
tags = ["go"]
title = "Go Web Apps: Risk Analyzer - Setup"
aliases = ["/2013/05/02/go-web-apps-risk-analyzer-pt-1/"]

+++

> **Disclaimer:** this is old content that's horribly out of date and possibly **very** incorrect. I've archived it here for historic purposes only. It's smelly, most likely not relevant, and I was still very much learning the language.

Kicking off today is a short series on building a fully working web application in Go. <!--more-->Based on my previous research into the subject:

*   [UP AND RUNNING WITH GO ON WEBFACTION][1]
*   [GO ENVIRONMENT VARIABLES: GOFIG][2]
*   [GO WEB APPLICATIONS: SERVING STATIC FILES][3]
*   [SETTING UP MONGODB ON WEBFACTION WITH GOLANG][4]

the web application we'll be building will be a Risk (the board game) battle predictor. The requirements for the application include:

*   Written in Go (obviously)
*   Uses [Bootstrap][5] for site styles
*   Posting a request should use AJAX and return a JSON response
*   Our battle simulator should be covered by tests 

We'll also ratchet up the complexity a notch by stating:

*   All unique battle results should be persisted in MongoDB 
*   If an attacker/defender combination has already been calculated return the persisted results instead running the engine

# The Battle Rules of Risk

For those of you not familiar with the Risk board game battles are resolved using contested die rolls. The attacker rolls a number of dice equal to 1 less than the total number of attacking armies, up to 3. The defender rolls a number of dice equal to the number of armies defending, up to two. *Note: the rules do state that the attacker/defender can choose how many dice they actually wish to roll within the above constraints but we're going to ignore that for this demonstration... and nobody ever really rolls less dice, do they?*

Once the dice have been rolled the highest results are compared against each other with the defender winning on ties. For each pair of dice compared the loser loses a single army. For example, if the attacker rolls: 6-5-2 and the defender rolls 5-5, the 6 and 5 are first compared and the attacker wins discarding one of the defenders armies. Then the next highest rolls are compared, in this case 5 and 5. Tie goes to the defender and the attacker loses a single army. The 2 is discarded.

# Adding the Static Files First

Before we add the main package code we'll go ahead and add the static files we're going to serve up. I've added a **static** folder to my package root that contains all of our static elements(markup, images, style sheets, etc...):

*   /static 
    *   /views 
        *   /home.html
    *   /images 
        *   /dice.gif
    *   /scripts 
        *   /risk.js
    *   /styles 
        *   /risk.css
*   app.go - where our Go code goes
*   gofig.json

Most reasonably sized web applications will contain many more layout/markup files; however, for our purposes, a single **home.html** file will service our purposes just fine. This post series will not contain a thorough delving into the built in Go templating engine (we'll cover it later). **dice.gif** is a dice rolling animated .gif we'll use to 'glitz' up our UI while the user is waiting for the battle logic to finish. Finally, **risk.js** will contain our custom client script we'll use to make our AJAX call and modify our DOM.

## home.html
{{< highlight html >}}
<!DOCTYPE html>
<html>
    <head>
        <title>Risk Dominator</title>
        <link href="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.1/css/bootstrap-combined.min.css" rel="stylesheet" />
        <link href="../styles/risk.css" rel="stylesheet" />
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
                    <form>
                        <fieldset>
                            <label for="attackingArmies">Attackers</label>
                            <input type="text" id="attackingArmies" />
                            <label for="defendingArmies">Defenders</label>
                            <input type="text" id="defendingArmies" />
                            <p>
                                <input type="submit" class="btn btn-primary btn-large" value="Roll the Dice!" />
                            </p>
                        </fieldset>
                    </form>
                </div>
                <div class="span3 well" style="display:none">
                    <div id="loadingAnimation">
                        <img src="../images/dice.gif" alt="rolling dice" />
                    </div>
                    <div id="result">
                        <h2>Result: <span id="percentage">100%</span></h2>
                    </div>
                </div>
            </div>
        </div>
        <script src="http://code.jquery.com/jquery-1.9.1.min.js"></script>
        <script src="../scripts/risk.js"></script>
        <script src="http://netdna.bootstrapcdn.com/twitter-bootstrap/2.3.1/js/bootstrap.min.js"></script>
    </body>
</html>
{{< /highlight >}}

Some things of note regarding the markup:

*   We're using a couple different CDN's to serve up our jQuery library and Bootstrap static files 
*   The second **span3** is where we'll be doing some div flipping to swap between our rolling dice and results.

# Get to the main Package already!

Ok, now that we have our static directory ready to go lets serve up the html! First things first, the packages we'll be importing:

{{< highlight go >}}
import (
    "github.com/gorilla/mux"
    "github.com/jkallhoff/gofig"
    "net/http"
)
{{< /highlight >}}

*   The [gorilla/mux][6] package gives us a very robust routing solution. Check the link for more information. 
*   **github.com/jkallhoff/gofig** is a package I wrote to handle pulling in application configuration variables at runtime. We'll use it for storing the port we'll be running our server on.
*   We'll use the **net/http** package for the rest of our web application needs.

# Serving Our Static Files

First things first we'll instantiate our new gorilla route multiplexer and add our single site root route:

{{< highlight go >}}
router := mux.NewRouter()
router.HandleFunc("/", homeHandler).Methods("GET")

http.Handle("/", router)
{{< /highlight >}}

**HandleFunc** takes in a **func** type, in this case our **homeHandler** function below. Since we're not actually using any templating for this solution there's no need to leverage the **html/template** package. Perhaps, as a final exercise, we'll add master layout/sub layout support to show the templating system in action. For now we can use the **net/http** package to serve up our static .html home page:

{{< highlight go >}}
func homeHandler(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "static/views/home.html")
    return
}
{{< /highlight >}}

We'll be expanding our route multiplexer in a later post when we add the HTTP POST support; today we're only interested in serving up our **home.html** file from the site root. Once our root route is added we need to add a route handler to handle all of our on disk static file access:

{{< highlight go >}}
http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, r.URL.Path[1:])
})
{{< /highlight >}}

*Note that the *r.URL.Path[1:]* merely pulls the leading '/' off of the request so that the pathing works correctly.*

Finally, lets add the line that spins up the app and listens on our configured port:

{{< highlight go >}}
panic(http.ListenAndServe(gofig.Str("webPort"), nil))
{{< /highlight >}}

Notice the call to **gofig.Str("webPort")** in that final line. The application we've built will compile without problem; however, when run the gofig package will panic because we haven't added the "webPort" configuration item to our **gofig.json** file. Make sure your gofig includes the following before running:

{{< highlight go >}}
{
    "webPort": ":8080"
}
{{< /highlight >}}

Now when you run your application you should see the rendered markup which includes a catchy logo and input fields for capturing attacker and defender army numbers! The output should look like the following (browser dependent):

[<img src="http://jessekallhoff.com/wp-content/uploads/2013/05/Screen-Shot-2013-05-01-at-8.40.50-AM-300x113.png" alt="Screen Shot 2013-05-01 at 8.40.50 AM" width="300" height="113" class="alignnone size-medium wp-image-156" />][7]

# State of the App After Post One

So far we've written a very simple web application that renders static content and runs on a configurable port. It currently contains no business logic and doesn't actually do much of anything at all except look default Bootstrap pretty. Here's our full **app.go** source up to this point:

{{< highlight go >}}
package main

import (
    "github.com/gorilla/mux"
    "github.com/jkallhoff/gofig"
    "net/http"
)

func main() {
    router := mux.NewRouter()
    router.HandleFunc("/", homeHandler).Methods("GET")

    http.Handle("/", router)
    http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, r.URL.Path[1:])
    })

    panic(http.ListenAndServe(gofig.Str("webPort"), nil))
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, "static/views/home.html")
    return
}
{{< /highlight >}}

The code for this post can be found underneath the following tag:

<https://github.com/JKallhoff/risk-analyzer-web/tree/v1.0>

In the next post we'll build out our battle engine/business logic and add some test coverage!

 [1]: /2013/04/04/up-and-running-with-go-on-webfaction/
 [2]: /2013/04/22/go-environment-variables-gofig/
 [3]: /2013/04/14/go-web-apps-serving-static-files/
 [4]: /2013/04/10/setting-up-mongodb-on-webfaction-with-go/
 [5]: http://twitter.github.io/bootstrap/
 [6]: http://www.gorillatoolkit.org/pkg/mux
 [7]: http://jessekallhoff.com/wp-content/uploads/2013/05/Screen-Shot-2013-05-01-at-8.40.50-AM.png