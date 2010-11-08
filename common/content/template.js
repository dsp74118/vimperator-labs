// Copyright (c) 2006-2009 by Kris Maglione <maglione.k at Gmail>
//
// This work is licensed for reuse under an MIT license. Details are
// given in the License.txt file included with this file.


/** @scope modules */

const Template = Module("template", {
    add: function add(a, b) a + b,
    join: function join(c) function (a, b) a + c + b,

    map: function map(iter, func, sep, interruptable) {
        if (iter.length) // FIXME: Kludge?
            iter = util.Array.itervalues(iter);
        let ret = <></>;
        let n = 0;
        for each (let i in Iterator(iter)) {
            let val = func(i);
            if (val == undefined)
                continue;
            if (sep && n++)
                ret += sep;
            if (interruptable && n % interruptable == 0)
                liberator.threadYield(true, true);
            ret += val;
        }
        return ret;
    },

    maybeXML: function maybeXML(xml) {
        if (typeof xml == "xml")
            return xml;
        try {
            return new XMLList(xml);
        }
        catch (e) {}
        return <>{xml}</>;
    },

    completionRow: function completionRow(item, highlightGroup) {
        if (typeof icon == "function")
            icon = icon();

        if (highlightGroup) {
            var text = item[0] || "";
            var desc = item[1] || "";
        }
        else {
            var text = this.process[0].call(this, item, item.text);
            var desc = this.process[1].call(this, item, item.description);
        }

        // <e4x>
        return <div highlight={highlightGroup || "CompItem"} style="white-space: nowrap">
                   <!-- The non-breaking spaces prevent empty elements
                      - from pushing the baseline down and enlarging
                      - the row.
                      -->
                   <li highlight="CompResult">{text}&#160;</li>
                   <li highlight="CompDesc">{desc}&#160;</li>
               </div>;
        // </e4x>
    },

    bookmarkDescription: function (item, text, filter)
    <>
        <a href={item.item.url} highlight="URL">({template.highlightFilter(text, filter)})</a>&#160;
        {
            !(item.extra && item.extra.length) ? "" :
            <span class="extra-info">
                ({
                    template.map(item.extra, function (e)
                    <>{e[0]}: <span highlight={e[2]}>{e[1]}</span></>,
                    <>&#xa0;</>/* Non-breaking space */)
                })
            </span>
        }
    </>,

    icon: function (item, text) {
        return <><span highlight="CompIcon">{item.icon ? <img src={item.icon}/> : <></>}</span><span class="td-strut"/>{text}</>
    },

    filter: function (str) <span highlight="Filter">{str}</span>,

    // if "processStrings" is true, any passed strings will be surrounded by " and
    // any line breaks are displayed as \n
    highlight: function highlight(arg, processStrings, clip) {
        // some objects like window.JSON or getBrowsers()._browsers need the try/catch
        try {
            let str = clip ? util.clip(String(arg), clip) : String(arg);
            switch (arg == null ? "undefined" : typeof arg) {
            case "number":
                return <span highlight="Number">{str}</span>;
            case "string":
                if (processStrings)
                    str = str.quote();
                return <span highlight="String">{str}</span>;
            case "boolean":
                return <span highlight="Boolean">{str}</span>;
            case "function":
                // Vim generally doesn't like /foo*/, because */ looks like a comment terminator.
                // Using /foo*(:?)/ instead.
                if (processStrings)
                    return <span highlight="Function">{str.replace(/\{(.|\n)*(?:)/g, "{ ... }")}</span>;
                return <>{arg}</>;
            case "undefined":
                return <span highlight="Null">{arg}</span>;
            case "object":
                // for java packages value.toString() would crash so badly
                // that we cannot even try/catch it
                if (/^\[JavaPackage.*\]$/.test(arg))
                    return <>[JavaPackage]</>;
                if (processStrings && false)
                    str = template.highlightFilter(str, "\n", function () <span highlight="NonText">^J</span>);
                return <span highlight="Object">{str}</span>;
            case "xml":
                return arg;
            default:
                return <><![CDATA[<unknown type>]]></>;
            }
        }
        catch (e) {
            return <><![CDATA[<unknown>]]></>;
        }
    },

    highlightFilter: function highlightFilter(str, filter, highlight) {
        if (filter.length == 0)
            return str;

        let filterArr = filter.split(" ");
        let matchArr = [];
        for (let [, item] in Iterator(filterArr)) {
            if (!item)
                continue;
            let lcstr = String.toLowerCase(str);
            let lcfilter = item.toLowerCase();
            let start = 0;
            while ((start = lcstr.indexOf(lcfilter, start)) > -1) {
                matchArr.push({pos:start, len:lcfilter.length});
                start += lcfilter.length;
            }
        }
        matchArr.sort(function(a,b) a.pos - b.pos); // Ascending start positions
        return this.highlightSubstrings(str, matchArr, highlight || template.filter);
    },

    highlightRegexp: function highlightRegexp(str, re, highlight) {
        let matchArr = [];
        let res;
        while ((res = re.exec(str)) && res[0].length)
            matchArr.push({pos:res.index, len:res[0].length});

        matchArr.sort(function(a,b) a.pos - b.pos); // Ascending start positions
        return this.highlightSubstrings(str, matchArr, highlight || template.filter);
    },

    highlightSubstrings: function highlightSubstrings(str, iter, highlight) {
        if (typeof str == "xml")
            return str;
        if (str == "")
            return <>{str}</>;

        str = String(str).replace(" ", "\u00a0");
        let s = <></>;
        let start = 0;
        let n = 0;
        for (let [, item] in Iterator(iter)) {
            if (n++ > 50) // Prevent infinite loops.
                return s + <>{str.substr(start)}</>;
            XML.ignoreWhitespace = false;
            s += <>{str.substring(start, item.pos)}</>;
            s += highlight(str.substr(item.pos, item.len));
            start = item.pos + item.len;
        }
        return s + <>{str.substr(start)}</>;
    },

    highlightURL: function highlightURL(str, force) {
        if (force || /^[a-zA-Z]+:\/\//.test(str))
            return <a highlight="URL" href={str}>{str}</a>;
        else
            return str;
    },

    // A generic output function which can have an (optional)
    // title and the output can be an XML which is just passed on
    genericOutput: function generic(title, xml) {
        if (title)
            return <><table style="width: 100%">
                       <tr style="text-align: left;" highlight="CompTitle">
                           <th>{title}</th>
                       </tr>
                       </table>
                       {xml}
                   </>;
        else
            return <>{xml}</>;
    },

    // every item must have a .xml property which defines how to draw itself
    // @param headers is an array of strings, the text for the header columns
    genericTable: function genericTable(items, format) {
        completion.listCompleter(function (context) {
            context.filterFunc = null;
            if (format)
                context.format = format;
            context.completions = items;
        });
    },

    jumps: function jumps(index, elems) {
        // <e4x>
        return this.genericOutput("",
            <table>
                <tr style="text-align: left;" highlight="Title">
                    <th colspan="2">jump</th><th>title</th><th>URI</th>
                </tr>
                {
                    this.map(Iterator(elems), function ([idx, val])
                    <tr>
                        <td class="indicator">{idx == index ? ">" : ""}</td>
                        <td>{Math.abs(idx - index)}</td>
                        <td style="width: 250px; max-width: 500px; overflow: hidden;">{val.title}</td>
                        <td><a href={val.URI.spec} highlight="URL jump-list">{val.URI.spec}</a></td>
                    </tr>)
                }
            </table>);
        // </e4x>
    },

    options: function options(title, opts) {
        // <e4x>
        return this.genericOutput("",
            <table style="width: 100%">
                <tr highlight="CompTitle" align="left">
                    <th>{title}</th>
                </tr>
                {
                    this.map(opts, function (opt)
                    <tr>
                        <td>
                            <span style={opt.isDefault ? "" : "font-weight: bold"}>{opt.pre}{opt.name}</span><span>{opt.value}</span>
                            {opt.isDefault || opt.default == null ? "" : <span class="extra-info"> (default: {opt.default})</span>}
                        </td>
                    </tr>)
                }
            </table>);
        // </e4x>
    },

    // only used by showPageInfo: look for some refactoring
    table: function table(title, data, indent) {
        let table =
        // <e4x>
            <table>
                <tr highlight="Title" align="left">
                    <th colspan="2">{title}</th>
                </tr>
                {
                    this.map(data, function (datum)
                    <tr>
                       <td style={"font-weight: bold; min-width: 150px; padding-left: " + (indent || "2ex")}>{datum[0]}</td>
                       <td>{template.maybeXML(datum[1])}</td>
                    </tr>)
                }
            </table>;
        // </e4x>
        if (table.tr.length() > 1)
            return table;
        return XML();
    },

    tabular: function tabular(headings, style, iter) {
        // TODO: This might be mind-bogglingly slow. We'll see.
        // <e4x>
        return this.genericOutput("",
            <table style="width: 100%">
                <tr highlight="CompTitle" align="left">
                {
                    this.map(headings, function (h)
                    <th>{h}</th>)
                }
                </tr>
                {
                    this.map(iter, function (row)
                    <tr highlight="CompItem">
                    {
                        template.map(Iterator(row), function ([i, d])
                        <td style={style[i] || ""}>{template.maybeXML(d)}</td>)
                    }
                    </tr>)
                }
            </table>);
        // </e4x>
    },

    usage: function usage(iter) {
        // <e4x>
        return this.genericOutput("Usage",
            <table>
            {
                this.map(iter, function (item)
                <tr>
                    <td highlight="Title" style="padding-right: 20px">{item.name || item.names[0]}</td>
                    <td>{item.description}</td>
                </tr>)
            }
            </table>);
        // </e4x>
    }
});

// vim: set fdm=marker sw=4 ts=4 et:
