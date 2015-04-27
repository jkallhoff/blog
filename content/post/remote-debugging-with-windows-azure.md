+++
date = "2014-07-09"
metadescription = "How to quickly set up remote debugging for Microsoft Azure Websites (PaaS) in Visual Studio 2013."
metatitle = "jkallhoff.com | Remote Debugging with Windows Azure"
series = []
tags = ["azure"]
title = "Remote Debugging with Windows Azure"

+++

I’ve recently found myself (as well as other developers at [The Nerdery][1]) relying on the **Websites** feature of [Windows Azure][2] for hosting everything from our scratch pad web applications and API’s on up to our production apps. Recently, while doing a deployment to one of our production websites on Azure, I found myself facing an Object Reference error which couldn’t be reproduced in any other non-production environment. Luckily, with the release of the Azure SDK 2.2, Microsoft enabled remote debugging of your website instances.

Steps:

**1\.** First things first you obviously need to have a website hosted on Azure to connect to. Using the existing portal you should see something like the following when logged into Azure under the Web Sites section:

![Web Sites view][3]

If you’re using the new Azure portal you’ll be able to view your websites by going to **Browse -> Websites**.

**2\.** *(note: I only performed these steps in Visual Studio 2013)*. In VS2013, within the Server Explorer window (and assuming that you’ve installed the Azure SDK 2.2) you should see a window tab for connecting to your Azure applications:

![Server Explorer][4]

If you haven’t already done so a screen will pop up prompting you for your Azure account credentials. Once you’ve entered them you should see your website(s) listed beneath the Web Sites section of the tree. Make sure that you have the code for the application you wish to debug loaded before continuing.

**3\.** Right click on the website you’re interested in debugging and click on **View Settings**. This will open up a window that allows you to configure a number of your website’s properties remotely. The setting we’re interested in is the **Remote Debugging** property. Set it to **On**:

![Website settings][5]

**4\.** You should now be able to again right click on the website entry you want to debug beneath the Websites section and click on the **Attach Debugger** button. This will launch your application in your default browser:

![Attach Debugger][6]

If everything went according to plan you should now be able to debug your application remotely! This was invaluable to me when it came to troubleshooting some pesky bugs in our application code. If you click the Attach Debugger button and end up with the following error:

![Error][7]

You’ll need to go into your Visual Studio options under **Tools -> Options**, click on the **Debugging** node, scroll all the way down to the bottom of the scroll pane on the right, and make sure that **Use Managed Compatability Mode** is unchecked:

![Managed Compatibility Mode][8]

Let me know how it works out for you!

 [1]: http://www.nerdery.com
 [2]: http://azure.microsoft.com/
 [3]: https://www.evernote.com/shard/s345/sh/9ee7db89-e4b6-48dd-9dcc-ea31fc7715fe/aa0e7d1ea3d86128e69a58ecd5dc06e0/deep/0/Web-Sites---Windows-Azure.png
 [4]: https://www.evernote.com/shard/s345/sh/1f94f79c-606f-40c3-a1b0-a66511b6ef1a/ab93db2d0dc09721049296e9539ed245/deep/0/Windows-8---Parallels-Desktop.png
 [5]: https://www.evernote.com/shard/s345/sh/2c7d16a3-d7fa-43e2-8422-c290e07569b6/ffb811f0c9db0efeb587dc20c34427a7/deep/0/Windows-8---Parallels-Desktop.png
 [6]: https://www.evernote.com/shard/s345/sh/16ac6064-5a62-4d97-9e09-c458d55d6a64/526a1925508eee2eb6d5f38ce78a7fab/deep/0/Windows-8---Parallels-Desktop.png
 [7]: https://www.evernote.com/shard/s345/sh/81feca73-4aff-4fc3-8a2a-1c313d43d365/5eebd8eac41a02c6ab61d98270c476de/deep/0/Windows-8---Parallels-Desktop.png
 [8]: https://www.evernote.com/shard/s345/sh/3db79637-1afe-49bb-970b-58aa3f2e5709/dde409488bf0b3b582afe96d6a0f569d/deep/0/Windows-8---Parallels-Desktop.png
