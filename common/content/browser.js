// Copyright (c) 2006-2009 by Martin Stubenschrott <stubenschrott@vimperator.org>
//
// This work is licensed for reuse under an MIT license. Details are
// given in the LICENSE.txt file included with this file.


/** @scope modules */

/**
 * @instance browser
 */
const Browser = Module("browser", {
}, {
    // TODO: support 'nrformats'? -> probably not worth it --mst
    incrementURL: function (count) {
        let matches = buffer.URL.match(/(.*?)(\d+)(\D*)$/);
        if (!matches)
            return void liberator.beep();

        let [, pre, number, post] = matches;
        let newNumber = parseInt(number, 10) + count;
        let newNumberStr = String(newNumber > 0 ? newNumber : 0);
        if (number.match(/^0/)) { // add 0009<C-a> should become 0010
            while (newNumberStr.length < number.length)
                newNumberStr = "0" + newNumberStr;
        }

        liberator.open(pre + newNumberStr + post);
    }
}, {
    options: function () {
        options.add(["encoding", "enc"],
            "Sets the current buffer's character encoding",
            "string", "UTF-8",
            {
                scope: options.OPTION_SCOPE_LOCAL,
                getter: function () getBrowser().docShell.QueryInterface(Ci.nsIDocCharset).charset,
                setter: function (val) {
                    if (options["encoding"] == val)
                        return val;

                    // Stolen from browser.jar/content/browser/browser.js, more or less.
                    try {
                        getBrowser().docShell.QueryInterface(Ci.nsIDocCharset).charset = val;
                        PlacesUtils.history.setCharsetForURI(getWebNavigation().currentURI, val);
                        getWebNavigation().reload(Ci.nsIWebNavigation.LOAD_FLAGS_CHARSET_CHANGE);
                    }
                    catch (e) { liberator.reportError(e); }
                },
                completer: function (context) completion.charset(context),
                validator: Option.validateCompleter
            });

        // only available in FF 3.5
        services.add("privateBrowsing", "@mozilla.org/privatebrowsing;1", Ci.nsIPrivateBrowsingService);
        if (services.get("privateBrowsing")) {
            options.add(["private", "pornmode"],
                "Set the 'private browsing' option",
                "boolean", false,
                {
                    setter: function (value) services.get("privateBrowsing").privateBrowsingEnabled = value,
                    getter: function () services.get("privateBrowsing").privateBrowsingEnabled
                });
            let services = modules.services; // Storage objects are global to all windows, 'modules' isn't.
            storage.newObject("private-mode", function () {
                ({
                    init: function () {
                        services.get("observer").addObserver(this, "private-browsing", false);
                        services.get("observer").addObserver(this, "quit-application", false);
                        this.private = services.get("privateBrowsing").privateBrowsingEnabled;
                    },
                    observe: function (subject, topic, data) {
                        if (topic == "private-browsing") {
                            if (data == "enter")
                                storage.privateMode = true;
                            else if (data == "exit")
                                storage.privateMode = false;
                            storage.fireEvent("private-mode", "change", storage.privateMode);
                        }
                        else if (topic == "quit-application") {
                            services.get("observer").removeObserver(this, "quit-application");
                            services.get("observer").removeObserver(this, "private-browsing");
                        }
                    }
                }).init();
            }, { store: false });
            storage.addObserver("private-mode",
                function (key, event, value) {
                    autocommands.trigger("PrivateMode", { state: value });
                }, window);
        }

        options.add(["urlseparator"],
            "Set the separator regex used to separate multiple URL args",
            "string", ",\\s");
    },

    mappings: function () {
        mappings.add([modes.NORMAL],
            ["y"], "Yank current location to the clipboard",
            function () { util.copyToClipboard(buffer.URL, true); });

        // opening websites
        mappings.add([modes.NORMAL],
            ["o"], "Open one or more URLs",
            function () { commandline.open(":", "open ", modes.EX); });

        mappings.add([modes.NORMAL], ["O"],
            "Open one or more URLs, based on current location",
            function () { commandline.open(":", "open " + buffer.URL, modes.EX); });

        mappings.add([modes.NORMAL], ["t"],
            "Open one or more URLs in a new tab",
            function () { commandline.open(":", "tabopen ", modes.EX); });

        mappings.add([modes.NORMAL], ["T"],
            "Open one or more URLs in a new tab, based on current location",
            function () { commandline.open(":", "tabopen " + buffer.URL, modes.EX); });

        mappings.add([modes.NORMAL], ["w"],
            "Open one or more URLs in a new window",
            function () { commandline.open(":", "winopen ", modes.EX); });

        mappings.add([modes.NORMAL], ["W"],
            "Open one or more URLs in a new window, based on current location",
            function () { commandline.open(":", "winopen " + buffer.URL, modes.EX); });

        mappings.add([modes.NORMAL],
            ["<C-a>"], "Increment last number in URL",
            function (count) { Browser.incrementURL(Math.max(count, 1)); },
            { count: true });

        mappings.add([modes.NORMAL],
            ["<C-x>"], "Decrement last number in URL",
            function (count) { Browser.incrementURL(-Math.max(count, 1)); },
            { count: true });

        mappings.add([modes.NORMAL], ["~"],
            "Open home directory",
            function () { liberator.open("~"); });

        mappings.add([modes.NORMAL], ["gh"],
            "Open homepage",
            function () { BrowserHome(); });

        mappings.add([modes.NORMAL], ["gH"],
            "Open homepage in a new tab",
            function () {
                let homepages = gHomeButton.getHomePage();
                liberator.open(homepages, { from: "homepage", where: liberator.NEW_TAB });
            });

        mappings.add([modes.NORMAL], ["gu"],
            "Go to parent directory",
            function (count) {
                function isDirectory(url) {
                    if (/^file:\/|^\//.test(url)) {
                        let file = io.File(url);
                        return file.exists() && file.isDirectory();
                    }
                    else {
                        // for all other locations just check if the URL ends with /
                        return /\/$/.test(url);
                    }
                }

                if (count < 1)
                    count = 1;

                // XXX
                let url = buffer.URL;
                for (let i = 0; i < count; i++) {
                    if (isDirectory(url))
                        url = url.replace(/^(.*?:)(.*?)([^\/]+\/*)$/, "$1$2/");
                    else
                        url = url.replace(/^(.*?:)(.*?)(\/+[^\/]+)$/, "$1$2/");
                }
                url = url.replace(/^(.*:\/+.*?)\/+$/, "$1/"); // get rid of more than 1 / at the end

                if (url == buffer.URL)
                    liberator.beep();
                else
                    liberator.open(url);
            },
            { count: true });

        mappings.add([modes.NORMAL], ["gU"],
            "Go to the root of the website",
            function () {
                let uri = content.document.location;
                if (/(about|mailto):/.test(uri.protocol)) // exclude these special protocols for now
                    return void liberator.beep();
                liberator.open(uri.protocol + "//" + (uri.host || "") + "/");
            });

        mappings.add([modes.NORMAL], ["<C-l>"],
            "Redraw the screen",
            function () { commands.get("redraw").execute("", false); });
    },

    commands: function () {
        commands.add(["downl[oads]", "dl"],
            "Show progress of current downloads",
            function () {
                liberator.open("chrome://mozapps/content/downloads/downloads.xul",
                    options.get("newtab").has("all", "downloads")
                        ? liberator.NEW_TAB : liberator.CURRENT_TAB);
            },
            { argCount: "0" });

        commands.add(["o[pen]", "e[dit]"],
            "Open one or more URLs in the current tab",
            function (args) {
                args = args.string;

                if (args)
                    liberator.open(args);
                else
                    liberator.open("about:blank");
            }, {
                completer: function (context) completion.url(context),
                literal: 0,
                privateData: true,
            });

        commands.add(["redr[aw]"],
            "Redraw the screen",
            function () {
                let wu = window.QueryInterface(Ci.nsIInterfaceRequestor)
                               .getInterface(Ci.nsIDOMWindowUtils);
                wu.redraw();
                modes.show();
            },
            { argCount: "0" });
    }
});

// vim: set fdm=marker sw=4 ts=4 et:
