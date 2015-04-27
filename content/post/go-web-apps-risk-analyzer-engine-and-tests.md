+++
date = "2013-05-13"
metadescription = "Writing a go web app to analyze the odds of winning as an attacker in the Risk board game. Covers writing unit tests in go(golang) to verify code accuracy."
metatitle = "jkallhoff.com | go web apps risk analyzer engine and tests"
series = ["archive","risk analyzer"]
tags = ["go"]
title = "go web apps risk analyzer engine and tests"

+++

> **Disclaimer:** this is old content that's horribly out of date and possibly **very** incorrect. I've archived it here for historic purposes only. It was written when the Go source wasn't yet housed at Github and I was still very much learning the language.

Now that we've set up our base web application to serve static files:

[Go Web Apps: Risk Analyzer][1]

It's time to move on to the meat of the application which is the actual Risk (the board game) brute force engine and accompanying tests. This will be a long post so, for those of you more interested in the tl;dr version, here's [The Synopsis][2] and finalized code.

We'll be building the risk engine as a sub package of the main web application we started putting together in the previous post. Get started by adding a folder to the root of the application named **riskEngine** and add the following two blank Go files to it:

*   battleCalculator.go
*   battleCalculator_test.go

**BattleCalculator.go** will hold our actual engine code and, as you may have guessed, **battleCalculator_test.go** will contain our unit tests.

# Getting To It: battleCalculator.go

The business requirement we're solving for is the following: **Build a risk brute force engine that, given a certain amount of attackers and defenders, will calculate both the percentage of battles won by the attacker and the average number of attacking armies left, given n number of simulations**.

Lets start off by creating the dependency that any caller of our engine will depend on:

{{< highlight go >}}
type BattleCalculator interface {
    CalculateBattleResults() *BattleResult
}
{{< /highlight >}}

The above **BattleCalculator** interface states that anything that would implement it **MUST** contain a **CalculateBattleResults()** method that returns a pointer to a **BattleResult** object (defined below). When our web application is wired to consume our **riskEngine** in a future post we'll use this interface to mock and test that it's being called correctly.

{{< highlight go >}}
type BattleResult struct {
    AverageNumberOfAttackersLeft int
    PercentageThatWereWins       float32
}
{{< /highlight >}}

Here's the definition of our **BattleResult** object we'll use to return both the average number of attackers left as well as the percentage of battles that were attacker wins.

Although we've defined our BattleCalculator interface we haven't yet created a type that implements it. Lets rectify that:

{{< highlight go >}}
type BattleRequest struct {
    AttackingArmies, DefendingArmies int
    NumberOfBattles                  int
    singleBattleResolver             func(*BattleRequest) *singleBattleResult
    diceRoller                       func(numberOfDiceToRoll int) []int
}
{{< /highlight >}}

Here we have a **BattleRequest** struct that we'll use to implement our **BattleCalculator** interface. First things first though we declare a few integer properties to hold the number of attacking armies, defending armies, and number of battle simulations to run. We also declare two method pointers as part of the type:

*   **singleBattleResolver** - a method that takes in a **BattleRequest** pointer and returns a pointer to a **singleBattleResult** (declared below)
*   **diceRoller** - a method that takes in the number of dice to roll and returns a slice of ints containing the resulting random die rolls.

## A Note on Scoping

Remember in Go that, in order to export (*expose to calling code/packages*) your methods, types, and vars they must be capitalized. Anything lower cased will be scoped to its package only and **not** available to any calling code/packages. Notice that in the definition of the **BattleRequest** struct our integer properties are exported because they are capitalized; however, the declared method pointers are lower cased and thus not accessible to any calling code.

This is how I solved for mocking dependencies in Go. I knew that my risk engine was going to include elements of randomness using the buit in [math/rand][3] package. Being able to generate random numbers is fantastic but it can make writing passing tests difficult. Thus I wanted to make sure that I could mock dice rolls for testing purposes while still utilizing random die rolls in the actual implementation. Same goes for the **singleBattleResolver** method pointer that determines the results of a single battle. Without being able to mock this functionality it would have been very difficult writing passing **meaningful** unit tests. **Because my test file is in the same package as my engine code it has access to un-exported symbols that other calling code can't access.** We'll dig into mocking these methods more below.

{{< highlight go >}}
type singleBattleResult struct {
    AttackingArmiesLeft int
    AttackerWon         bool
}
{{< /highlight >}}

Here we're defining a non-exported struct to hold the results of a single battle. In the grand scheme of things we want to know what the average number of attacking armies left was as well as the percentage of battles won by the attacker; however, for a single battle we're only interested in the actual number left as well as if the attacker won or not.

## Wiring up BattleRequest to Implement BattleCalculator

In order for our **BattleRequest** object to implement our **BattleCalculator** interface the request object must contain a **CalculateBattleResults() *BattleResult** method signature. Lets add one:

{{< highlight go >}}
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
    return
}
{{< /highlight >}}

There's a bit of a leaky abstraction because we're seeding our random number generator here even though random is only used in the dependent **diceRoller** method. I had originally included this line in my **rollTheDice** method but found that it caused a major performance slow down; moving the seeding outside the call greatly sped up the overall engine.

After seeding our random generator we create a slice of **singleBattleResult** pointers sized and set with an initial slice capacity equal to the number of battles requested. We'll use this to hold each single battle result for later processing.

{{< highlight go >}}
if request.singleBattleResolver == nil {
    request.singleBattleResolver = determineSingleBattle
}

if request.diceRoller == nil {
    request.diceRoller = rollTheDice
}
{{< /highlight >}}

The next two **if** statements is where our default concrete dependency wiring comes into play. If the calling code that created the **BattleRequest** object didn't set the **singleBattleResolver** and **diceRoller** method pointers equal to actual methods both properties by default will equal **nil**. The trick of it is that anything that creates a new **BattleRequest** outside of the **riskEngine** package **can't** see these properties since they're not exported and thus we're almost guaranteed that our desired default concrete implementations of these methods will be wired up. Here you can see that we're wiring those methods up to two methods also declared in the **battleCalculator.go** file: **determineSingleBattle** and **rollTheDice**.

{{< highlight go >}}
for index, _ := range battles {
        battles[index] = request.singleBattleResolver(request)
    }
{{< /highlight >}}

Here we're looping through each element in the **battles** slice and setting its value equal to a call to our **singleBattleResolver** which returns a pointer to a **singelBattleResult** object.

{{< highlight go >}}
result = request.calculateBattleResult(battles)
return
{{< /highlight >}}

Finally, set **result** equal to a call to the **calculateBattleResult** function passing in the **battles** slice followed by returning from the method.

# Rolling the Dice

Lets go ahead and add in our random die rolling. The approach I want to take with this is to make sure that, for every set of dice rolled, the results would be sorted highest to lowest. This makes it super easy to compare two sets of dice to determine winner/loser on a given dice comparison.

The built in [sort][4] package allows us to sort our resulting int slice lowest to highest which doesn't help us a ton. After some Google digging I came up with the following approach:

{{< highlight go >}}
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
{{< /highlight >}}

By declaring our own interface for sorting our integers with our own **Less** method we're able to now sort the integers in the direction we'd like. **rollTheDice** is fairly straight forward. First we declare an integer slice that will hold the number of results we requested. We then loop through the slice inserting a random number from 1 to 6. Finally we return the sorted results.

# Determining the Results of a Single Battle

{{< highlight go >}}
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

Here we have our default concrete function we're using for our **BattleRequest** **singleBattleResolver** function pointer. The purpose of this method is to determine the results of a single battle returning the result as a **singleBattleResult** pointer.

Notice that the core logic is wrapped in a **for** statement that continues looping while there is more than 1 remaining attacking army and at least 1 defender remaining. For each loop iteration we:

*   Calculate the number of attacker dice to roll. 
*   Calculate the number of defender dice to roll.
*   Call the request's **diceRoller** method pointer for both the attacker and defender grabbing the resulting integer slice.
*   Compare index 0 in both slices and decrement the appropriate army total
*   If both slices have a value in the 1 index compare those results and decrement the appropriate army total.

Once we've hit the point where the battle is over we determine if the attacker won or not setting the **AttackerWon** boolean on the returning **singleBattleResult** pointer.

# And the Results

The final bit of functionality we're adding is the **calculateBattleRequest** call which is responsible for forming up our final **BattleResult** pointer, populating the appropriate bits:

{{< highlight go >}}
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
{{< /highlight >}}

The above should be pretty straight forward. We're looping through the passed in slice of **singleBattleResult** pointers and incrementing our values accordingly. Before returning we calculate the average number of attackers left as well as determine the percentage of battles where the attacker won.

# Testing In Go

Testing in Go uses the built in testing framework/packages that are heavily convention based. Some of those conventions are as follows:

*   The file that contains your unit tests should be appended with **_test** as in **battleCalculator_test.go**. 
*   The code within that file should be included in the same package as the code under test (i.e. if **battleCalculator.go** is part of the **riskEngine** package then your **_test.go** file should also be part of that package).
*   All tests within your test file need to be prepended with the word **Test** (see below)

Test execution in Go is handled by calling the **go test** command which will, based on the above conventions, execute all of the tests in the package. Later you should be able to path to the **riskEngine** folder, execute:

{{< highlight bash >}}
$go test -v
{{< /highlight >}}

And see something like the following for output:

    === RUN TestCustomSingleBattleResolver
    --- PASS: TestCustomSingleBattleResolver (0.00 seconds)
    === RUN TestCustomDiceRoller
    --- PASS: TestCustomDiceRoller (0.00 seconds)
    === RUN TestDefaultRollTheDiceLengthOfReturn
    --- PASS: TestDefaultRollTheDiceLengthOfReturn (0.00 seconds)
    === RUN TestDefaultRollTheDiceSortsResultOrder
    --- PASS: TestDefaultRollTheDiceSortsResultOrder (0.00 seconds)
    === RUN TestSingleCalculatedBattleResult
    --- PASS: TestSingleCalculatedBattleResult (0.00 seconds)
    === RUN TestPercentageOfWinsFor100
    --- PASS: TestPercentageOfWinsFor100 (0.00 seconds)
    === RUN TestMultipleCalculatedBattleResult
    --- PASS: TestMultipleCalculatedBattleResult (0.00 seconds)
    === RUN TestMultipleCalculatedBattleResultWithVaryingAttackers
    --- PASS: TestMultipleCalculatedBattleResultWithVaryingAttackers (0.00 seconds)
    === RUN TestMultipleCalculatedBattleResultWithSomeLosers
    --- PASS: TestMultipleCalculatedBattleResultWithSomeLosers (0.00 seconds)
    === RUN TestRunSeriesOfBattlesAndVerifyResults
    --- PASS: TestRunSeriesOfBattlesAndVerifyResults (0.00 seconds)
    === RUN TestFullIntegration
    2013/05/13 10:30:41 &riskEngine.BattleResult{AverageNumberOfAttackersLeft:10, PercentageThatWereWins:91.799995}
    --- PASS: TestFullIntegration (0.01 seconds)
    PASS
    ok      github.com/JKallhoff/risk-analyzer-web/riskEngine   0.036s
    

## Learning to Test in Go

Coming from a C# world there are a multitude of different testing patterns and frameworks to choose from. From different testing frameworks/runners( MSTest, NUnit, Specflow) to different mocking libraries (Rhino Mocks, Moq, FakeItEasy) writing tests in .NET offers many different flavors to please most everyone. Having been a test writer in C# for going on 6+ years I'd settled into an easy routine of defining my dependencies using interfaces, injecting my dependencies using IoC containers like Ninject or Autofac, and using mocking libraries to mock my dependencies at test time. In fact, I'd grown so used to this code structuring that I had a hard time approaching testing in Go where interfaces aren't explicitly implemented and types are duck typed.

If you Google *Mocking in Golang* you'll find a number of lively debates where certain individuals, confused as I was with mocking in Go, would be told that they needed to change the way they looked at dependencies in Go and possibly needed to revisit why they thought mocking was even necessary. I myself still consider the ability to mock my dependencies a crucial part of testing but, thanks to a couple of really great tips, was able to land on a mocking approach in go I find satisfactory.

## Some Testing Rules I Like to Adhere To

The following is a list of rules I use when writing tests. These are purely the result of a handful of years learning by testing and are by no means the only way to do things. They just work for me:

*   Stick to 15 lines of code or less in your tests (not including comments). If you need more than this you most likely have too much setup which is a strong sign that your code under test is attempting to do too much (**single responsibility**)
*   Organize your tests into **Arrange, Act, Assert** chunks. First, arrange your test for testing. Then act by calling the code under test. Finally, assert the results
*   When possible try to assert a single business rule per test
*   Only test one thing, not that thing plus its dependencies. i.e. If your function under test calls another method that sends an email make sure you don't have to send an email when calling your test (*Note, this is where mocking comes in*)

# On to the Unit Tests

I'm not going to walk through all of the unit tests I added to the engine; you can see the whole list below. Note that this isn't complete coverage. There are a number of edge cases I'll be adding tests for as I think of them. Here I'm going to show a few examples of tests I wrote and walk through them.

## Verifying Our Mocking Works

{{< highlight go >}}
func TestCustomSingleBattleResolver(t *testing.T) {
    //Arrange
    var mockResolver = func(*BattleRequest) (result *singleBattleResult) {
        result = new(singleBattleResult)
        result.AttackingArmiesLeft = 20 //arbitrary amount
        return
    }

    //Act
    request := BattleRequest{singleBattleResolver: mockResolver}

    //Assert
    if result := request.singleBattleResolver(&request); result.AttackingArmiesLeft != 20 {
        t.Error("We were unable to override the single battle resolver")
    }
}
{{< /highlight >}}

This first test is an example of mocking the **singleBattleResolver** method dependency. I wanted to make sure I could plug in mocked behavior and then verify that the mock was actually called. So the above forms up a function that matches the signature declared in the **BattleRequest** object. The function returns a hard coded **singleBattleResult** object with a hard coded **AttackingArmiesLeft** value of 20.

Next we declare a new **BattleRequest** object setting our **singleBattleResolver** equal to our mock method. Finally we call and verify that the result does indeed equal 20.

## Verifying Our Dice Results Are Sorted

{{< highlight go >}}
func TestDefaultRollTheDiceSortsResultOrder(t *testing.T) {
    //Arrange,Act,Assert
    for i := 0; i < 20; i++ {
        results := rollTheDice(10)

        previous := results[0]
        for _, digit := range results {
            if digit > previous {
                t.Errorf("%v Values are unsorted", results)
                break
            }
            previous = digit
        }
    }
}
{{< /highlight >}}

Here I wanted to write a test to verify that the **rollTheDice** method sorts its results before returning. In this test we iterate through the results and compare each index to the previous index, throwing an error if we encounter a number that's larger than the previous number.

## Verifying We're Calculating the Correct Battle Results

{{< highlight go >}}
func TestMultipleCalculatedBattleResultWithVaryingAttackers(t *testing.T) {
    //Arrange
    request := new(BattleRequest)
    singleBattleResults := []*singleBattleResult{
        &singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true},
        &singleBattleResult{AttackingArmiesLeft: 12, AttackerWon: true}}

    //Assert,Act
    if battleResult := request.calculateBattleResult(singleBattleResults); battleResult.AverageNumberOfAttackersLeft != 8 {
        t.Errorf("Excepted average of 8, instead got %v", battleResult.AverageNumberOfAttackersLeft)
    }
}
{{< /highlight >}}

The above tests the **calculateBattleResult** function verifying that it correctly calculates the average number of attackers left. Taking in two **singleBattleResult** pointers we make the call to **calculateBattleResult** verifying that the result is 8 (the integer average of 5 and 12).

<a name="Synopsis"></a>

# The Synopsis

The Go language and tools come with a convention based testing framework built in. Leveraging this framework we created a Risk brute force engine that will compute the odds of an attacker winning n battles given x attackers and y defenders. In order to test the engine we explored how to loosely couple our code as well as mock specific dependencies. Here's the finalized code for the engine as well as the full set of tests:

### battleCalculator.go

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

type BattleRequest struct {
    AttackingArmies, DefendingArmies int
    NumberOfBattles                  int
    singleBattleResolver             func(*BattleRequest) *singleBattleResult
    diceRoller                       func(numberOfDiceToRoll int) []int
}

type BattleResult struct {
    AverageNumberOfAttackersLeft int
    PercentageThatWereWins       float32
}

type singleBattleResult struct {
    AttackingArmiesLeft int
    AttackerWon         bool
}

type diceResultSorter struct {
    sort.Interface
}

func (sorter diceResultSorter) Less(i, j int) bool {
    return sorter.Interface.Less(j, i)
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

func rollTheDice(numberOfDiceToRoll int) (results []int) {
    results = make([]int, numberOfDiceToRoll)
    for index, _ := range results {
        results[index] = rand.Intn(6) + 1
    }
    sort.Sort(diceResultSorter{sort.IntSlice(results)})
    return
}
{{< /highlight >}}

### And some backing tests

{{< highlight go >}}
package riskEngine

import (
    "log"
    "testing"
)

func TestCustomSingleBattleResolver(t *testing.T) {
    //Arrange
    var mockResolver = func(*BattleRequest) (result *singleBattleResult) {
        result = new(singleBattleResult)
        result.AttackingArmiesLeft = 20 //arbitrary amount
        return
    }

    //Act
    request := BattleRequest{singleBattleResolver: mockResolver}

    //Assert
    if result := request.singleBattleResolver(&request); result.AttackingArmiesLeft != 20 {
        t.Error("We were unable to override the single battle resolver")
    }
}

func TestCustomDiceRoller(t *testing.T) {
    //Arrange
    var mockRoller = func(numberOfDiceToRoll int) (results []int) {
        results = make([]int, 1)
        results[0] = 100
        return
    }

    //Act
    request := BattleRequest{diceRoller: mockRoller}

    //Assert
    if result := request.diceRoller(1); result[0] != 100 {
        t.Error("We were unable to override the dice roller")
    }
}

func TestDefaultRollTheDiceLengthOfReturn(t *testing.T) {
    //Arrange,Act,Assert
    results := rollTheDice(3)
    if length := len(results); length != 3 {
        t.Errorf("The number of dice rolled should have been 3 but instead was: %v", length)
    }
}

func TestDefaultRollTheDiceSortsResultOrder(t *testing.T) {
    //Arrange,Act,Assert
    for i := 0; i < 20; i++ {
        results := rollTheDice(10)

        previous := results[0]
        for _, digit := range results {
            if digit > previous {
                t.Errorf("%v Values are unsorted", results)
                break
            }
            previous = digit
        }
    }
}

func TestSingleCalculatedBattleResult(t *testing.T) {
    //Arrange
    request := new(BattleRequest)
    singleBattleResults := []*singleBattleResult{&singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true}}

    //Assert,Act
    if battleResult := request.calculateBattleResult(singleBattleResults); battleResult.AverageNumberOfAttackersLeft != 5 {
        t.Errorf("Excepted average of 5, instead got %v", battleResult.AverageNumberOfAttackersLeft)
    }

}

func TestPercentageOfWinsFor100(t *testing.T) {
    //Arrange
    request := new(BattleRequest)
    singleBattleResults := []*singleBattleResult{&singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true}}

    //Assert,Act
    if battleResult := request.calculateBattleResult(singleBattleResults); battleResult.PercentageThatWereWins != 100.0 {
        t.Errorf("Excepted percentage of wins of 100.0, instead got %v", battleResult.PercentageThatWereWins)
    }
}

func TestMultipleCalculatedBattleResult(t *testing.T) {
    //Arrange
    request := new(BattleRequest)
    singleBattleResults := []*singleBattleResult{
        &singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true},
        &singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true}}

    //Assert,Act
    if battleResult := request.calculateBattleResult(singleBattleResults); battleResult.AverageNumberOfAttackersLeft != 5 {
        t.Errorf("Excepted average of 5, instead got %v", battleResult.AverageNumberOfAttackersLeft)
    }

}

func TestMultipleCalculatedBattleResultWithVaryingAttackers(t *testing.T) {
    //Arrange
    request := new(BattleRequest)
    singleBattleResults := []*singleBattleResult{
        &singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true},
        &singleBattleResult{AttackingArmiesLeft: 12, AttackerWon: true}}

    //Assert,Act
    if battleResult := request.calculateBattleResult(singleBattleResults); battleResult.AverageNumberOfAttackersLeft != 8 {
        t.Errorf("Excepted average of 8, instead got %v", battleResult.AverageNumberOfAttackersLeft)
    }
}

func TestMultipleCalculatedBattleResultWithSomeLosers(t *testing.T) {
    //Arrange
    request := new(BattleRequest)
    singleBattleResults := []*singleBattleResult{
        &singleBattleResult{AttackingArmiesLeft: 5, AttackerWon: true},
        &singleBattleResult{AttackingArmiesLeft: 1, AttackerWon: false}}

    //Assert,Act
    if battleResult := request.calculateBattleResult(singleBattleResults); battleResult.PercentageThatWereWins != 50.0 {
        t.Errorf("Excepted average of 50.0, instead got %v", battleResult.PercentageThatWereWins)
    }
}

//test determineSingleBattle(*BattleRequest)
func TestRunSeriesOfBattlesAndVerifyResults(t *testing.T) {
    //Arrange
    request := FetchBattleRequest(4, 2, 1)

    //Act,Assert
    RunSingleBattleTest(t, request, 6, 5, 4) //Attacker should win due to 6's beating 5's
    RunSingleBattleTest(t, request, 5, 5, 1) //Defender should win due to 5's tying 5's
    RunSingleBattleTest(t, request, 5, 6, 1) //Defender should win due to 6's beating 5's
}

//Helpers
func RunSingleBattleTest(t *testing.T, request *BattleRequest, attackerDice, defenderDice, expectedNumberOfAttackersLeft int) {
    state := 1
    var mockRoller = func(numberOfDiceToRoll int) (results []int) {
        results = make([]int, numberOfDiceToRoll)
        if state == 1 {
            for i := range results {
                results[i] = attackerDice
            }
            state = 2
        } else {
            for i := range results {
                results[i] = defenderDice
            }
            state = 1
        }
        return
    }
    request.diceRoller = mockRoller
    if singleResult := determineSingleBattle(request); singleResult.AttackingArmiesLeft != expectedNumberOfAttackersLeft {
        t.Errorf("Expected %v attackers left but instead found %v", expectedNumberOfAttackersLeft, singleResult.AttackingArmiesLeft)
    }
}

func FetchBattleRequest(attackingArmies, defendingArmies, numberOfBattles int) (request *BattleRequest) {
    request = new(BattleRequest)
    request.AttackingArmies = attackingArmies
    request.DefendingArmies = defendingArmies
    request.NumberOfBattles = numberOfBattles
    return
}
{{< /highlight >}}

I've tagged the code in the repo for this post here: [v2.0][5]. Next post we'll tie our engine to our web application and add MongoDB persistence!

 [1]: 2013/05/02/go-web-apps-risk-analyzer---setup/
 [2]: #Synopsis
 [3]: http://golang.org/pkg/math/rand/
 [4]: http://golang.org/pkg/sort/
 [5]: https://github.com/JKallhoff/risk-analyzer-web/tree/v2.0