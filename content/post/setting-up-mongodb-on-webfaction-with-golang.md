+++
date = "2013-04-10"
metadescription = "Step by step guide to setting up MongoDB on Webfaction for use with your golang applications using the mgo driver."
metatitle = "jessekallhoff.com | setting up mongodb on webfaction with go"
series = ["archive"]
tags = ["go","webfaction"]
title = "Setting Up Mongodb on Webfaction with Go"

+++

> **Disclaimer:** this is old content that's horribly out of date and possibly **very** incorrect. I've archived it here for historic purposes only. It smelly, most likely not relevant, and I was still very much learning the language.


In this post we'll be walking step by step through how to set up your own MongoDB instance<!--more--> in your [Webfaction][1] account. In addition I'll show you a trick I use to work with the instance locally to ease my Go development. Finally we'll use the excellent [mgo][2] MongoDB Go driver to create a super simple Go app that'll read and write data to our new MongoDB instance.

## Installing MongoDB On Webfaction

*If you don't already have a Webfaction account and/or haven't set up Go on it please take a moment to work through my previous post on the topic: [Up and Running With Go on Webfaction][3]*

Setting up MongoDB in your Webfaction is a fairly straightforward process that's well documented here: <http://docs.webfaction.com/software/mongodb.html>

I won't repeat the steps verbatim but there are a couple addendum notes you should be aware of before we move on to the next steps:

*   Step 1.i. - this is extremely important. Make sure to write down your custom application port number because we'll need it down the line.
*   Step 3.b. - you can find this information on the Account/Dashboard tab when logged into Webfactional
*   Step 4.f. - also extremely important. Write down the username and password you chose because we'll need it for later.

For easy reference I've copied over the string to start your MongoDB instance here:

{{< highlight bash >}}
$mongod --auth --dbpath $HOME/webapps/application/data/ --port <custom app port value>
{{< /highlight >}}

Remember to replace *application* with your actual application name and *custom app port value* with your actual assigned port number.

## Installing Bazaar

Assuming you followed all of the steps in the Webfaction guide you should have a running instance of MongoDB. The MongoDB driver we're going to use for interacting with our database from Go is [mgo][2]. The mgo driver has a dependency on the [Bazaar version control system][5] being installed.

### Installing on your local box

Your local development environment will vary so follow the installation instructions found here: <http://wiki.bazaar.canonical.com/Download>

I'm on a mac with Homebrew installed so installation was as simple as:

{{< highlight bash >}}
     $brew install bzr
{{< /highlight >}}

You'll know if the installation was successful if the following command gives you bazaar help information:
{{< highlight bash >}}
     $bzr
{{< /highlight >}}

### Installing in your Webfaction account

If you haven't already done so go ahead and SSH to your Webfaction account. Once connected the following command will install bazaar:

{{< highlight bash >}}
     $easy_install bzr
{{< /highlight >}}

Again, test by using the $bzr command. You should be presented with help information. More bazaar and Webfaction information can be found here: <http://docs.webfaction.com/software/bazaar.html>

## Create The Local Go MongoDB Test Program

For our demonstration we're going to use the actual example program found on the mgo homepage:

{{< highlight go >}}
    package main
    
    import (
            "fmt"
            "labix.org/v2/mgo"
            "labix.org/v2/mgo/bson"
    )
    
    type Person struct {
            Name string
            Phone string
    }
    
    func main() {
            session, err := mgo.Dial("username:password@localhost:27017")
            if err != nil {
                    panic(err)
            }
            defer session.Close()
    
            // Optional. Switch the session to a monotonic behavior.
            session.SetMode(mgo.Monotonic, true)
    
            c := session.DB("test").C("people")
            err = c.Insert(&Person{"Ale", "+55 53 8116 9639"},
                       &Person{"Cla", "+55 53 8402 8510"})
            if err != nil {
                    panic(err)
            }
    
            result := Person{}
            err = c.Find(bson.M{"name": "Ale"}).One(&result)
            if err != nil {
                    panic(err)
            }
    
            fmt.Println("Phone:", result.Phone)
    }
{{< /highlight >}}

The only line that differs from their example program is the connection string itself. Remember when I told you to remember your username and password? This is where that will come in handy. Go ahead and replace the username and password with the ones you added to your MongoDB instance during setup. **Note:** do not change the port from 27017. This is the default port that MongoDB runs on and will almost certainly differ from the port your custom application was assigned. If you **must** change the port because you have something else running on it take note of what you changed it to because you'll need to modify the SSH string used below.

Go ahead and build/run the above program. If the build step fails because it can't find the mgo libraries you'll need to first install them using the Go Get command:

{{< highlight bash >}}
     $go get labix.org/v2/mgo
{{< /highlight >}}

At this point everything should be good. However, when you run the program you'll notice that it... doesn't do much of anything for about 10 seconds before throwing a bunch of gobbly gook error messages your way. The key error string that tells us what's going on is:
{{< highlight bash >}}
     panic: no reachable servers
{{< /highlight >}}

Which should make perfect sense considering we surely don't have a local MongoDB instance running on port 27017 for the program to connect to! Lets correct that.

## Connecting to the MongoDB Instance Locally

We're now going to open up an SSH tunnel that will effectively route any local requests for port 27017 to the custom port assigned to your custom Webfaction application. In a new terminal window execute the following command:
{{< highlight bash >}}
     ssh username@username.webfactional.com -L 27017:localhost:port -N
{{< /highlight >}}

Make sure to replace *username* with your actual username and *port* with your custom port. If it works as expected you should be prompted for your account password. Once entered the SSH tunnel is complete. Go ahead and run your program again. You should now fairly quickly see:

     Phone: +55 53 8116 9639
    

**This means the connection was successful!** You should now be able to interface directly with your MongoDB instance while developing locally. Note that, if/when you deploy your Go application to your Webfaction account you'll need to change your connection string port to your custom application port. In a future post I'll cover how to create an environment config file that will allow you to automate injecting these environment specific values.

### Security Notice

I'm a big fan of using [github.com][6] both for versioning my Go apps as well as deploying my apps to Webfaction. **Make sure you don't check in your username and password in your code before deploying to github or any other public repo!** You may be inadvertently exposing them to anybody that's browsing your code!

 [1]: http://www.webfaction.com
 [2]: http://labix.org/mgo
 [3]: http://jessekallhoff.com/2013/04/04/up-and-running-with-go-on-webfaction/
 [5]: http://wiki.bazaar.canonical.com/
 [6]: http://github.com