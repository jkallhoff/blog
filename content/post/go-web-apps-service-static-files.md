+++
date = "2013-04-14"
metadescription = "One approach to serving static content from Go (Golang) web applications."
metatitle = "jkallhoff.com | go web apps serving static files"
series = ["archive"]
tags = ["go"]
title = "Go Web Apps Serving Static Files"

+++

> **Disclaimer:** this is old content that's horribly out of date and possibly **very** incorrect. I've archived it here for historic purposes only. It was written when the Go source wasn't yet housed at Github and I was still very much learning the language.

One feature of Go web applications I struggled with early on was how to serve my static (css, js, images, etc...) content. Here's the setup that ended up working for me!<!--more-->

**My working GOPATH directory structure:**

*   /src 
    *   /webapp 
        *   **webapp.go** - my go web application source
        *   /static 
            *   /img 
                *   **test.gif** - static image file I want to render in the browser

The goal, when done, will be for the following url to return the **test.gif** test image, assuming that the web application is listening on port *17901*:

    http://localhost:17901/static/img/test.gif
    

## webapp.go

Here's what **webapp.go** looks like before adding in static file support:

{{< highlight go >}}
package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", homeHandler)
    panic(http.ListenAndServe(":17901", nil))
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "<html><head></head><body><h1>Welcome Home!</h1></body></html>")
}
{{< /highlight >}}
    

This really is about as basic as it gets. A simple Go web application that only responds to root requests. Point your browser to

     http://localhost:17901 
    

and you should see a big Welcome Home! However, if you try the following:

    http://localhost:17901/static/img/test.gif
    

you should be greeted with a *404*. Lets add static file support!

## Adding Static Files

Add the following below your home handler:

{{< highlight go >}}
http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
    http.ServeFile(w, r, r.URL.Path[1:])
})
{{< /highlight >}}

Couple things worth noting here. This is using the ***net/http*** package's *ServeFile* function to serve our content. Effectively anything that makes a request starting with the */static/* path will be handled by this function. One thing I found I had to do in order for the request to be handled correctly was trim the leading '/' using:

{{< highlight go >}}
r.URL.Path[1:]
{{< /highlight >}}

Also note that this will be looking for the requested file in a static folder relative to the executing application i.e. just like my folder structure detailed above. If you want to move your static folder elsewhere you'll need to modify the *ServeFile* call accordingly. Now, open up your browser and lets try loading our image again:

    http://localhost:17901/static/img/test.gif
    

You should now see your file image delivered directly to your browser! Adding stylesheets, scripts, etc. will all work the same way now that we have this working.

## Tidying Up

Lets modify our home page markup to serve up an anchor that will, when clicked, load up our test image. Here's the final code for webapp.go:

{{< highlight go >}}
package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/", homeHandler)
    http.HandleFunc("/static/", func(w http.ResponseWriter, r *http.Request) {
        http.ServeFile(w, r, r.URL.Path[1:])
    })
    panic(http.ListenAndServe(":17901", nil))
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "<html><head></head><body><h1>Welcome Home!</h1><a href=\"/static/img/test.gif\">Show Image!</a></body></html>")
}
{{< /highlight >}}

If you run the above you'll see you now have an anchor on your home page that, when clicked, should load the same test image as we loaded previously directly!