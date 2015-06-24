+++
date = "2015-06-24"
metadescription = "How to deal with the kqueue() FileSystemWatcher unhandled exception when building vNext web apps on osx"
metatitle = "jkallhoff.com | dealing with mono issue when running vnext website on osx"
series = []
tags = ["aspnet","vnext"]
title = "ASPNET vNext on OSX: kqueue() FileSystemWatcher has reached the maximum number of files to watch"

+++

The other day I was playing around with [Visual Studio Code](https://code.visualstudio.com/Download) on my mac I stumbled across a runtime error stating the following:

> IOException: kqueue() FileSystemWatcher has reached the maximum nunmber of files to watch.

Turns out it's a mono issue (I'm currently on mono 4.0.1 and .NET Execution Environment 1.0.0-beta4). Here's the link to the temporary fix until it's fixed permanently:  [https://github.com/OmniSharp/generator-aspnet/issues/138](https://github.com/OmniSharp/generator-aspnet/issues/138).

The answer is to set a mono environment variable in your console:

{{< highlight bash >}}
export MONO_MANAGED_WATCHER=false
{{< /highlight >}}

Once set your website should load without issue.
