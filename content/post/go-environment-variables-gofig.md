+++
date = "2013-04-22"
metadescription = "How to utilize the GoFig Go package to load a configuration object at runtime for environment specific configuration variables."
metatitle = "jkallhoff.com | go environment variables gofig"
series = ["archive"]
tags = ["go"]
title = "Go Environment Variables: GoFig"

+++

> **Disclaimer:** this is old content that's horribly out of date and possibly **very** incorrect. I've archived it here for historic purposes only. It was written when the Go source wasn't yet housed at Github and I was still very much learning the language.

One problem I ran into early in my efforts to build web applications using Go was managing environment specific variables. Coming from an ASP.Net background I was used to having a plethora of .config files I could use and deploy depending on my target environment.<!--more--> Not wanting to check my MongoDB connection string into my test Go application's Git repo (see the **Security Notice** at the bottom of my [MongoDB on Webfaction][1] post) I set out to create a super light weight configuration package.

# GoFig

GoFig is the start of my attempt at creating a configuration solution for Go web applications. Some initial constraints I placed on myself when creating it:

*   It must be file based (i.e. no reliance on OS environment vars)
*   It must be a JSON structure (i.e. no XML)
*   It must not have an adverse impact on performance (i.e. load once and cache)
*   It must be usable without any manual initialization/setup (i.e. no need to call a **Load()** or **Init()**)

The GitHub repo can be found here: <https://github.com/JKallhoff/gofig>. Currently the code is made up of two files:

*   **config.go**
*   **gofig.go**

We'll examine **config.go** first.

## config.go
{{< highlight go >}}
package gofig

import (
    "encoding/json"
    "log"
    "os"
)

//Private vars
const (
    fileName string = "gofig.json"
)

//Types
type config struct {
    values map[string]string
}

func (c *config) populate() {
    configFile, err := os.Open(fileName)
    if err != nil {
        log.Panic(err)
    }
    defer func() {
        configFile.Close()
    }()

    configFileStats, err := configFile.Stat()
    if err != nil {
        log.Panic(err)
    }

    buffer := make([]byte, configFileStats.Size())
    _, err = configFile.Read(buffer)
    if err != nil {
        log.Panic(err)
    }

    err = json.Unmarshal(buffer, &c.values)
    if err != nil {
        log.Panic(err)
    }
}

func (c *config) val(id string) interface{} {
    return c.values[id]
}
{{< /highlight >}}

One thing to notice right off the bat is that everything in **config.go** is not publicly exported; the scope of all definitions are firmly rooted in the gofig package. This is on purpose. I'd like for the only exported methods to be the conversion methods found in the **gofig.go** file; everything else is hidden from public consumption (remember, public vs. private is handled by capitalizing the first letter of a member or method).

{{< highlight go >}}
//Private vars
const (
    fileName string = "gofig.json"
)
{{< /highlight >}}

Right now **GoFig** is rather opinionated and expects the application's configuration to be found in a file named **gofig.json**

{{< highlight go >}}
configFile, err := os.Open(fileName)
    if err != nil {
        log.Panic(err)
    }
    defer func() {
        configFile.Close()
    }()
{{< /highlight >}}

Here we're asking the **os** package to open our config file in the same path directory as the executing Go application and return a ***File** pointer. We're also using **defer** to make sure we close the file when the **populate** method ends regardless of success or failure. If there's a problem opening the config file we cause a runtime error using the **Panic()** method. **[More info on the File type][2]**

{{< highlight go >}}
configFileStats, err := configFile.Stat()
if err != nil {
    log.Panic(err)
}
{{< /highlight >}}

For now we're going to read the entire config file in a single large buffer sized to the size of the config file. In order to determine the size of the file we make a call to the file pointer's **Stat()** method which returns a **[FileInfo][3]** object.

{{< highlight go >}}
buffer := make([]byte, configFileStats.Size())
_, err = configFile.Read(buffer)
if err != nil {
    log.Panic(err)
}
{{< /highlight >}}

Next we create a **byte** slice sized to the size of our config file. The **Read()** call loads the file into the buffer, panicking on error.

{{< highlight go >}}
type config struct {
    values map[string]string
}
{{< /highlight >}}

The config struct, declared at the top of the **config.go** file, contains a simple string map we'll use to house our JSON values in.

{{< highlight go >}}
err = json.Unmarshal(buffer, &c.values)
if err != nil {
    log.Panic(err)
}
{{< /highlight >}}

Finally, we utilize the **json** package to Unmarshal the contents of the buffer into our **config** pointer, panicking if any errors occur.

## gofig.go

As mentioned above everything declared in the **config.go** file is private to the **GoFig** package. The only exported members are found here in the **gofig.go** file:

{{< highlight go >}}
package gofig

//Private vars
var (
    loadedConfig *config = new(config)
)

//Public functions
func Str(id string) string {
    return loadedConfig.val(id).(string)
}

//Private functions
func init() {
    loadedConfig.populate()
}
{{< /highlight >}}

This one is much simpler than **config.go**. Go has built in support for running all **init()** methods it finds in a package in appropriate dependency order. Here, our **Init()** method makes a call to the **populate()** method declared in the **config.go** file. This happens auto-magically when your application loads without any need to call a specific **load()/init()/parse()/etc...** method.

Once loaded the file is cached in the private **loadedConfig** variable. Right now the only public method in the entire package is the **Str()** method which requests a value expecting that it be returned as a string.

# Installing and Using GoFig

To use GoFig first intall it using the Go tool from your GOPATH:

{{< highlight bash >}}
$go get github.com/jkallhoff/gofig github.com/jkallhoff/gofig
{{< /highlight >}}

Here's an example file that uses GoFig for pulling in the MongoDB connection string:

{{< highlight go >}}
package data

import (

    "github.com/jkallhoff/gofig"
    "labix.org/v2/mgo"
    "log"
)

var (
    session mgo.Session
)

func init() {
    session, err := mgo.Dial(gofig.Str("connectionString"))
    log.Println("DB Connectioned")
    if err != nil {
        panic(err)
    }
    defer func() {
        session.Close()
        log.Println("Session Closed")
    }()

    // Optional. Switch the session to a monotonic behavior.
    session.SetMode(mgo.Monotonic, true)
}
{{< /highlight >}}

And here's the **gofig.json** file that I'm using in the root of the application:

{{< highlight json >}}
{
    "connectionString": "username:password@localhost:27017"
}
{{< /highlight >}}

As mentioned above, just by including the package in the dependency chain, the package's **init()** method will be called and the **gofig.json** file will be cached in memory.

**Side Note:** In my particular case I wanted to store sensitive information in my config file that could be loaded at runtime without needing to be checked into my Git repo. I added a **gofig.json** clause to my **.gitignore** file and manually copied up a version that was specific to my host at **Webfaction**.

# Making It Better

Some features I'd like to add, time permitting:

*   Being able to declare a different configuration file name
*   Being able to load a _test config file for unit testing purposes
*   More conversion methods: **integer**, **float**, etc...
*   Being able to switch which config file is loaded based on an argument flag

 [1]: /2013/04/10/setting-up-mongodb-on-webfaction-with-go/
 [2]: http://golang.org/pkg/os/#File
 [3]: http://golang.org/pkg/os/#FileInfo