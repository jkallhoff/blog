+++
date = "2013-04-04"
metadescription = "A step by step guide to setting up a hosted Go web application on Webfaction."
metatitle = "jkallhoff.com | Up and Running With Go on Webfaction"
series = ["archive"]
tags = ["go", "webfaction"]
title = "Up and Running With Go on Webfaction"

+++

Over the past handful of weeks I've set aside other development research and started pouring over all of the GO documentation I could get my hands on. After numerous hello world style applications I've decided today is the day to take Go to the next level: **hosted web applications**!

<!--more-->

### Webfaction \<http://www.webfaction.com\>

*Disclaimer: This is probably a good time to explain that I'm not a 'command line' kind of guy having spent the better part of the last decade entrenched firmly in Visual Studio. Things like SSH are new to me... and don't get me started on Vim*

I decided to start my Go hosting experiment with Webfaction based solely off of some posts I had scanned at the \<https://groups.google.com/forum/?fromgroups#!forum/golang-nuts\> golang-nuts Google group. Webfaction seemed like the perfect fit for hosting my first Go web application; not only does it offer the usual assortment of shared hosting provider perks but it also offers SSH access. This along with their claim of being a **developer's host** made me believe I'd be able to be up and running in no time. Roughly, the steps we'll take to a hosted Go web application will be the following:

1.  Install Mercurial and modify our .bash\_profile 
2.  Use Mercurial to pull the latest Go source
3.  Compile the source **with passing unit tests!**
4.  Setup your initial GOPATH workspace
5.  Add a custom Webfaction application to secure an available port
6.  **Add a super simple helloworld.go web application and run it!**
7.  Finally, point a Webfaction website to your new Go web application!

*Simple, right?*

## Webfaction Account Setup

I'm going to leave this step to you but here's a link to the sign up page: \<https://www.webfaction.com/signup/\>. Once you've signed up you should receive an email shortly giving you a link to log into your new Webfaction account to see your account details. The email will include the auto-generated password you'll use to log into your account.

### SSH

Guide to accessing your data with SSH: \<http://docs.webfaction.com/user-guide/access.html#connecting-with-ssh\>. The method you use will depend on your operating system. On the mac using iTerm:

{{< highlight bash >}}
$ ssh username.webfactional.com -l username
{{< /highlight >}}


*Note: replace username with your actual username*

Assuming you entered the above correctly your terminal should prompt you for your password you received in your setup email. After entering your password you should be dropped in your Webfaction account root.

### SFTP

Before we move any further you'll need some way to modify your .bash\_profile file found hidden in your site root. Unless you're super familiair with Vim (I'm not) you'll want to grab an OS appropriate SFTP client and connect to your account root. Here's documentation on how to connect: \<http://docs.webfaction.com/user-guide/access.html#connecting-with-ftp\>

Once you've acquired an appropriate SFTP application and connected to your account root go ahead and download your .bash\_profile file. Crack it open and add the following:

{{< highlight bash >}}
PATH=$PATH:$HOME/lib/go/bin
export GOROOT=$HOME/lib/go
export GOPATH=$HOME/gosrc
export GOBIN=$HOME/gosrc/bin
export TMPDIR=$HOME/temp
{{< /highlight >}}

These environment vars aren't relevant yet but they all will be used as we step through the setup process below. Getting it out of the way now means you won't have to revisit your .bash\_profile file later. Upload your modified .bash\_profile file back to your account root. *You may need to log in and out of SSH to see the new environment variables take hold.*

## Install Mercurial

Once you've connected to your account via SSH installing Mercurial should be as simple as:

{{< highlight bash >}}
 $ easy\_install Mercurial
{{< /highlight >}}

Once the easy\_install command completes you'll want to verify that the *hg* command is ready to go:

{{< highlight bash >}}
 $ hg
{{< /highlight >}}

That should show you the help text for the *hg* command. More information can be found here: \<http://docs.webfaction.com/software/mercurial.html\>

## Use Mercurial to pull the latest Go Source

Before we grab the source lets go ahead and add a temp folder to your account root:

{{< highlight bash >}}
 cd  mkdir temp
{{< /highlight >}}

Head into your /lib folder and use hg to pull the latest Go code:

{{< highlight bash >}}
 hg clone -u release https://code.google.com/p/go
{{< /highlight >}}

If all goes according to plan you should end up with a Go folder beneath your /lib folder.

{{< highlight bash >}}
 $ cd /lib/go/src 
 $ ./all.bash 
{{< /highlight >}}


Go grab a soda and some chips... this will take a while. You should now see all of the Go core library packages being built followed by all of the language unit tests being run. All tests should pass without fail!

## Setup your initial GOPATH workspace

Now that we have Go compiled the next step is to create our Go workspace. **Our code must live somewhere!**.
{{< highlight bash >}}
$ mkdir /gosrc
$ mkdir /gosrc/bin
$ mkdir /gosrc/pkg
$ mkdir /gosrc/src
{{< /highlight >}}

\*Note: these paths correspond to the values we setup in your .bash\_profile file previously

## Add a custom Webfaction application to secure an available port

Finally we're ready to start configuring Webfaction's applications to work with our up coming Go program:

*   Log into your Webfaction dashboard
*   Click on the **Domains/Websites** header
*   Click on the **Applications** sub-header
*   Click the **Add New Application** button 
	*   Give your application a unique name. I named mine **GoHome**
	*   Select **Custom** in the App Category dropdown
	*   Select **Custom App(Listening on port)** in the App Type dropdown 
	*   Finally, click the **save** button and wait for your new application to be built.

Once complete you should be brought back to your applications list and you should see your shiny new application. **Take note of what port your application was given** (mine was 17901). We'll need it for later.

## Add a super simple helloworld.go web application and run it!

Using the SFTP client configured above add a new file **helloworld.go** to '/gosrc/src/code'. Paste the following into it:

{{< highlight go >}}
package main

import (
"fmt"
"net/http"
)

func handler(w http.ResponseWriter, r \*http.Request) {
   fmt.Fprintf(w, "Hi there, I love %s!", r.URL.Path[1:]())
}

func main() {
   http.HandleFunc("/", handler)
   http.ListenAndServe(":17901", nil)
}
{{< /highlight >}}

**Make sure to replace the port in the above code with the port you were assigned**. Upload the file to /gosrc/src/code before continuing.

{{< highlight bash >}}
$ cd /gosrc/src/code
$ go build
{{< /highlight >}}

If everything goes as planned **nothing** should be outputted by the *go build* command. **This is a good thing!**.

{{< highlight bash >}}
$ ls 
{{\< /highlight \>}}

You should now see a file *code* in the code folder. Finally, lets execute it!

{{< highlight bash >}}
$ ./code
{{< /highlight >}}

You now have a running Go web application! We're not done yet though. We still need to have Webfaction point a web application to our app.

## Adding a web application

*   If you're not already logged into your Webfaction dashboard do so now
*   Click on Domain/websites
*   Click on Websites

When your Webfaction account was created they already set you up with a default static web application. You should see it in the list of website now. Click on it to edit it.

In the Content box clear out the existing application, select Reuse an Existing Application from the drop down, and point it to the application you created above.

Open a browser and point it to http://username.webfactional.com and, if everything went according to plan, *You should see your go application delivering content to your browser!*

