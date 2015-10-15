/*!
 *  dc 2.0.0-dev
 *  http://nickqizhu.github.io/dc.js/
 *  Copyright 2012 Nick Zhu and other contributors
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

dc = (function(){
'use strict';

/**
#### Version 2.0.0-dev

The entire dc.js library is scoped under **dc** name space. It does not introduce anything else into the global
name space.

* [Base Chart [abstract]](#base-chart)
* [Color Chart [abstract]](#color-chart)
* [Stackable Chart [abstract]](#stackable-chart)
* [Coordinate Grid Chart [abstract] < Color Chart < Base Chart](#coordinate-grid-chart)
* [Pie Chart [concrete] < Color Chart < Base Chart](#pie-chart)
* [Row Chart [concrete] < Color Chart < Base chart](#row-chart)
* [Bar Chart [concrete] < Stackable Chart < CoordinateGrid Chart](#bar-chart)
* [Line Chart [concrete] < Stackable Chart < CoordinateGrid Chart](#line-chart)
* [Composite Chart [concrete] < CoordinateGrid Chart](#composite-chart)
* [Abstract Bubble Chart [abstract] < Color Chart](#abstract-bubble-chart)
* [Bubble Chart [concrete] < Abstract Bubble Chart < CoordinateGrid Chart](#bubble-chart)
* [Bubble Overlay Chart [concrete] < Abstract Bubble Chart < Base Chart](#bubble-overlay-chart)
* [Geo Choropleth Chart [concrete] < Color Chart < Base Chart](#geo-choropleth-chart)
* [Data Count Widget [concrete] < Base Chart](#data-count)
* [Data Table Widget [concrete] < Base Chart](#data-table)
* [Number Display [Concrete] < Base Chart](#number-display)
* [Legend [concrete]](#legend)
* [Listeners](#listeners)
* [Utilities](#util)

#### Function Chain
Majority of dc functions are designed to allow function chaining, meaning it will return the current chart instance
whenever it is appropriate. Therefore configuration of a chart can be written in the following style.
```js
chart.width(300)
    .height(300)
    .filter("sunday")
```
The API references will highlight the fact if a particular function is not chainable.

**/
var dc = {
    version: "2.0.0-dev",
    constants: {
        CHART_CLASS: "dc-chart",
        DEBUG_GROUP_CLASS: "debug",
        STACK_CLASS: "stack",
        DESELECTED_CLASS: "deselected",
        SELECTED_CLASS: "selected",
        NODE_INDEX_NAME: "__index__",
        GROUP_INDEX_NAME: "__group_index__",
        DEFAULT_CHART_GROUP: "__default_chart_group__",
        EVENT_DELAY: 40,
        NEGLIGIBLE_NUMBER: 1e-10
    },
    _renderlet: null
};

dc.chartRegistry = function() {
    // chartGroup:string => charts:array
    var _chartMap = {};

    function initializeChartGroup(group) {
        if (!group)
            group = dc.constants.DEFAULT_CHART_GROUP;

        if (!_chartMap[group])
            _chartMap[group] = [];

        return group;
    }

    return {
        has: function(chart) {
            for (var e in _chartMap) {
                if (_chartMap[e].indexOf(chart) >= 0)
                    return true;
            }
            return false;
        },

        register: function(chart, group) {
            group = initializeChartGroup(group);
            _chartMap[group].push(chart);
        },

        clear: function(group) {
            if (group) {
                delete _chartMap[group];
            } else {
                _chartMap = {};
            }
        },

        list: function(group) {
            group = initializeChartGroup(group);
            return _chartMap[group];
        }
    };
}();

dc.registerChart = function(chart, group) {
    dc.chartRegistry.register(chart, group);
};

dc.hasChart = function(chart) {
    return dc.chartRegistry.has(chart);
};

dc.deregisterAllCharts = function(group) {
    dc.chartRegistry.clear(group);
};

/**
## <a name="util" href="#util">#</a> Utilities
**/

/**
#### dc.filterAll([chartGroup])
Clear all filters on every chart within the given chart group. If the chart group is not given then only charts that
belong to the default chart group will be reset.
**/
dc.filterAll = function(group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        charts[i].filterAll();
    }
};

/**
#### dc.renderAll([chartGroup])
Re-render all charts belong to the given chart group. If the chart group is not given then only charts that belong to
 the default chart group will be re-rendered.
**/
dc.renderAll = function(group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        charts[i].render();
    }

    if(dc._renderlet !== null)
        dc._renderlet(group);
};

/**
#### dc.redrawAll([chartGroup])
Redraw all charts belong to the given chart group. If the chart group is not given then only charts that belong to the
  default chart group will be re-drawn. Redraw is different from re-render since when redrawing dc charts try to update
  the graphic incrementally instead of starting from scratch.
**/
dc.redrawAll = function(group) {
    var charts = dc.chartRegistry.list(group);
    for (var i = 0; i < charts.length; ++i) {
        charts[i].redraw();
    }

    if(dc._renderlet !== null)
        dc._renderlet(group);
};

dc.disableTransitions = false;
dc.transition = function(selections, duration, callback) {
    if (duration <= 0 || duration === undefined || dc.disableTransitions)
        return selections;

    var s = selections
        .transition()
        .duration(duration);

    if (typeof(callback) === 'function') {
        callback(s);
    }

    return s;
};

dc.units = {};

/**
#### dc.units.integers
This function can be used to in [Coordinate Grid Chart](#coordinate-grid-chart) to define units on x axis.
dc.units.integers is the default x unit scale used by [Coordinate Grid Chart](#coordinate-grid-chart) and should be
used when x range is a sequential of integers.

**/
dc.units.integers = function(s, e) {
    return Math.abs(e - s);
};

/**
#### dc.units.ordinal
This function can be used to in [Coordinate Grid Chart](#coordinate-grid-chart) to define ordinal units on x axis.
Usually this function is used in combination with d3.scale.ordinal() on x axis.
**/
dc.units.ordinal = function(s, e, domain){
    return domain;
};

/**
#### dc.units.fp.precision(precision)
This function generates xunit function in floating-point numbers with the given precision. For example if the function
is invoked with 0.001 precision then the function created will divide a range [0.5, 1.0] with 500 units.

**/
dc.units.fp = {};
dc.units.fp.precision = function(precision){
    var _f = function(s, e){
        var d = Math.abs((e-s)/_f.resolution);
        if(dc.utils.isNegligible(d - Math.floor(d)))
            return Math.floor(d);
        else
            return Math.ceil(d);
    };
    _f.resolution = precision;
    return _f;
};

dc.round = {};
dc.round.floor = function(n) {
    return Math.floor(n);
};
dc.round.ceil = function(n) {
    return Math.ceil(n);
};
dc.round.round = function(n) {
    return Math.round(n);
};

dc.override = function(obj, functionName, newFunction) {
    var existingFunction = obj[functionName];
    obj["_" + functionName] = existingFunction;
    obj[functionName] = newFunction;
};

dc.renderlet = function(_){
    if(!arguments.length) return dc._renderlet;
    dc._renderlet = _;
    return dc;
};

dc.instanceOfChart = function (o) {
    return o instanceof Object && o.__dc_flag__ && true;
};

dc.errors = {};

dc.errors.Exception = function(msg) {
    var _msg = msg || "Unexpected internal error";

    this.message = _msg;

    this.toString = function(){
        return _msg;
    };
};

dc.errors.InvalidStateException = function() {
    dc.errors.Exception.apply(this, arguments);
};

dc.dateFormat = d3.time.format("%m/%d/%Y");

dc.printers = {};

dc.printers.filters = function (filters) {
    var s = "";

    for (var i = 0; i < filters.length; ++i) {
        if (i > 0) s += ", ";
        s += dc.printers.filter(filters[i]);
    }

    return s;
};

dc.printers.filter = function (filter) {
    var s = "";

    if (filter) {
        if (filter instanceof Array) {
            if (filter.length >= 2)
                s = "[" + dc.utils.printSingleValue(filter[0]) + " -> " + dc.utils.printSingleValue(filter[1]) + "]";
            else if (filter.length >= 1)
                s = dc.utils.printSingleValue(filter[0]);
        } else {
            s = dc.utils.printSingleValue(filter);
        }
    }

    return s;
};

dc.pluck = function(n,f) {
    return function(d,i) {
        return f ? f.call(this,d[n],i) : d[n];
    };
};

dc.utils = {};

dc.utils.printSingleValue = function (filter) {
    var s = "" + filter;

    if (filter instanceof Date)
        s = dc.dateFormat(filter);
    else if (typeof(filter) == "string")
        s = filter;
    else if (dc.utils.isFloat(filter))
        s = dc.utils.printSingleValue.fformat(filter);
    else if (dc.utils.isInteger(filter))
        s = Math.round(filter);

    return s;
};
dc.utils.printSingleValue.fformat = d3.format(".2f");

dc.utils.add = function (l, r) {
    if (typeof r === "string")
        r = r.replace("%", "");

    if (l instanceof Date) {
        if (typeof r === "string") r = +r;
        var d = new Date();
        d.setTime(l.getTime());
        d.setDate(l.getDate() + r);
        return d;
    } else if (typeof r === "string") {
        var percentage = (+r / 100);
        return l > 0 ? l * (1 + percentage) : l * (1 - percentage);
    } else {
        return l + r;
    }
};

dc.utils.subtract = function (l, r) {
    if (typeof r === "string")
        r = r.replace("%", "");

    if (l instanceof Date) {
        if (typeof r === "string") r = +r;
        var d = new Date();
        d.setTime(l.getTime());
        d.setDate(l.getDate() - r);
        return d;
    } else if (typeof r === "string") {
        var percentage = (+r / 100);
        return l < 0 ? l * (1 + percentage) : l * (1 - percentage);
    } else {
        return l - r;
    }
};

dc.utils.GroupStack = function () {
    var _dataLayers = [[ ]];
    var _groups = [];
    var _defaultAccessor;
    var _hideChartGroup;

    function initializeDataLayer(i) {
        if (!_dataLayers[i])
            _dataLayers[i] = [];
    }

    this.setDataPoint = function (layerIndex, pointIndex, data) {
        initializeDataLayer(layerIndex);
        _dataLayers[layerIndex][pointIndex] = data;
    };

    this.getDataPoint = function (x, y) {
        initializeDataLayer(x);
        var dataPoint = _dataLayers[x][y];
        if (dataPoint === undefined)
            dataPoint = 0;
        return dataPoint;
    };

    this.addGroup = function (group, accessor) {
        if (!accessor)
            accessor = _defaultAccessor;
        _groups.push([group, accessor]);
        return _groups.length - 1;
    };

    this.addNamedGroup = function (group, name, accessor) {
        var groupIndex = this.addGroup(group, accessor);
        _groups[groupIndex].name = name;
        return name;
    };

    this.getGroupByIndex = function (index) {
        return _groups[index][0];
    };

    this.getAccessorByIndex = function (index) {
        return _groups[index][1];
    };

    this.getNameByIndex = function (index) {
        return _groups[index].name;
    };

    this.size = function () {
        return _groups.length;
    };

    this.clear = function () {
        _dataLayers = [];
        _groups = [];
    };

    this.setDefaultAccessor = function (retriever) {
        _defaultAccessor = retriever;
    };

    this.getDataLayers = function () {
        return _dataLayers;
    };

    this.clearDataLayers = function() {
        _dataLayers = [[ ]];
    };

    this.showGroups = function(name, showChartGroup) {
        if (showChartGroup) _hideChartGroup = false;
        this.toggleGroups(name, false);
    };

    this.hideGroups = function(name, hideChartGroup) {
        if (hideChartGroup) _hideChartGroup = true;
        this.toggleGroups(name, true);
    };

    this.toggleGroups = function(name, value) {
        for (var i = 0; i < _groups.length; ++i) {
            if (_groups[i].name === name)
                _groups[i].hidden = value;
        }
    };

    this.setTitle = function(name, titleAccessor) {
        for (var i = 0; i < _groups.length; ++i) {
            if (_groups[i].name === name)
                _groups[i].title = titleAccessor;
        }
    };

    this.getTitle = function(name) {
        for (var i = 0; i < _groups.length; ++i) {
            if (_groups[i].name === name)
                return _groups[i].title;
        }
    };

    this.toLayers = function () {
        var layers = [];

        for (var i = 0; i < _dataLayers.length; ++i) {
            if (i === 0 && _hideChartGroup)
                continue;
            if (i > 0 && _groups[i-1].hidden)
                continue;

            var layer = {index: i, points: []};
            var dataPoints = _dataLayers[i];

            for (var j = 0; j < dataPoints.length; ++j)
                layer.points.push(dataPoints[j]);

            layers.push(layer);
        }

        return layers;
    };
};

dc.utils.isNumber = function(n) {
    return n===+n;
};

dc.utils.isFloat = function (n) {
    return n===+n && n!==(n|0);
};

dc.utils.isInteger = function (n) {
    return n===+n && n===(n|0);
};

dc.utils.isNegligible = function (max) {
    return max === undefined || (max < dc.constants.NEGLIGIBLE_NUMBER && max > -dc.constants.NEGLIGIBLE_NUMBER);
};

var _idCounter = 0;
dc.utils.uniqueId = function () {
    return ++_idCounter;
};

dc.utils.groupMax = function (group, accessor) {
    var max = d3.max(group.all(), accessor);
    if (dc.utils.isNegligible(max)) max = 0;
    return max;
};

dc.utils.groupMin = function (group, accessor) {
    var min = d3.min(group.all(), accessor);
    if (dc.utils.isNegligible(min)) min = 0;
    return min;
};

dc.utils.nameToId = function (name) {
    return name.toLowerCase().replace(/[\s]/g, "_").replace(/[\.']/g, "");
};

dc.utils.appendOrSelect = function (parent, name) {
    var element = parent.select(name);
    if (element.empty()) element = parent.append(name);
    return element;
};

dc.utils.createLegendable = function (chart, group, accessor, color) {
    var legendable = {name: chart._getGroupName(group, accessor), data: group};
    if (color) legendable.color = color;
    //(typeof chart.dashStyle === 'function') ? legendable.dashstyle = chart.dashStyle() : [];
    return legendable;
};

dc.utils.safeNumber = function(n){return dc.utils.isNumber(+n)?+n:0;};

dc.events = {
    current: null
};

/**
#### dc.events.trigger(function[, delay])
This function is design to trigger throttled event function optionally with certain amount of delay(in milli-seconds).
Events that are triggered repetitively due to user interaction such as the dragging of the brush might over flood
library and cause too much rendering being scheduled. In this case, using this function to wrap your event function
allows the library to smooth out the rendering by throttling event flood and only respond to the most recent event.

```js
    chart.renderlet(function(chart){
        // smooth the rendering through event throttling
        dc.events.trigger(function(){
            // focus some other chart to the range selected by user on this chart
            someOtherChart.focus(chart.filter());
        });
    })
```
**/
dc.events.trigger = function(closure, delay) {
    if (!delay){
        closure();
        return;
    }

    dc.events.current = closure;

    setTimeout(function() {
        if (closure == dc.events.current)
            closure();
    }, delay);
};

/**
## <a name="base-chart" href="#base-chart">#</a> Base Chart [Abstract]
Base chart is an abstract functional object representing a basic dc chart object for all chart and widget implementation.
Every function on base chart are also inherited available on all concrete chart implementation in dc library.

**/
dc.baseChart = function (_chart) {
    _chart.__dc_flag__ = dc.utils.uniqueId();

    var _dimension;
    var _group;

    var _anchor;
    var _root;
    var _svg;

    var _minWidth = 200;
    var _default_width = function (element) {
        var width = element && element.getBoundingClientRect && element.getBoundingClientRect().width;
        return (width && width > _minWidth) ? width : _minWidth;
    };
    var _width = _default_width;

    var _minHeight = 200;
    var _default_height = function (element) {
        var height = element && element.getBoundingClientRect && element.getBoundingClientRect().height;
        return (height && height > _minHeight) ? height : _minHeight;
    };
    var _height = _default_height;

    var _keyAccessor = dc.pluck('key');
    var _valueAccessor = dc.pluck('value');
    var _label = dc.pluck('key');

    var _ordering = dc.pluck('key');
    var _orderSort;

    var _renderLabel = false;

    var _title = function (d) {
        return _chart.keyAccessor()(d) + ": " + _chart.valueAccessor()(d);
    };
    var _renderTitle = false;

    var _transitionDuration = 750;

    var _filterPrinter = dc.printers.filters;

    var _renderlets = [];
    var _mandatoryAttributes = ['dimension', 'group'];

    var _chartGroup = dc.constants.DEFAULT_CHART_GROUP;

    var NULL_LISTENER = function () {};

    var _listeners = {
        preRender: NULL_LISTENER,
        postRender: NULL_LISTENER,
        preRedraw: NULL_LISTENER,
        postRedraw: NULL_LISTENER,
        filtered: NULL_LISTENER,
        zoomed: NULL_LISTENER
    };

    var _legend;

    var _filters = [];
    var _filterHandler = function (dimension, filters) {
        dimension.filter(null);

        if (filters.length === 0)
            dimension.filter(null);
        else if (filters.length === 1)
            dimension.filter(filters[0]);
        else
            dimension.filterFunction(function (d) {
                return filters.indexOf(d) >= 0;
            });

        return filters;
    };

    var _data = function (group) {
        return group.all();
    };

    /**
    #### .width([value])
    Set or get width attribute of a chart. See `.height` below for further description of the behavior.

    **/
    _chart.width = function (w) {
        if (!arguments.length) return _width(_root.node());
        _width = d3.functor(w || _default_width);
        return _chart;
    };

    /**
    #### .height([value])
    Set or get height attribute of a chart. The height is applied to the SVG element
    generated by the chart when rendered (or rerendered). If a value is given, then it
    will be used to calculate the new height and the chart returned for method chaining.
    The value can either be a numeric, a function, or falsy. If no value specified then
    value of the current height attribute will be returned.

    By default, without an explicit height being given, the chart will select the width
    of its anchor element. If that isn't possible it defaults to 200;

    Examples:

    ```js
    chart.height(250); // Set the chart's height to 250px;
    chart.height(function(anchor) { return doSomethingWith(anchor); }); // set the chart's height with a function
    chart.height(null); // reset the height to the default auto calculation
    ```

    **/
    _chart.height = function (h) {
        if (!arguments.length) return _height(_root.node());
        _height = d3.functor(h || _default_height);
        return _chart;
    };

    /**
    #### .minWidth([value])
    Set or get minimum width attribute of a chart. This only applicable if the width is calculated by DC.

    **/
    _chart.minWidth = function (w) {
        if (!arguments.length) return _minWidth;
        _minWidth = w;
        return _chart;
    };

    /**
    #### .minHeight([value])
    Set or get minimum height attribute of a chart. This only applicable if the height is calculated by DC.

    **/
    _chart.minHeight = function (w) {
        if (!arguments.length) return _minHeight;
        _minHeight = w;
        return _chart;
    };

    /**
    #### .dimension([value]) - **mandatory**
    Set or get dimension attribute of a chart. In dc a dimension can be any valid
    [crossfilter dimension](https://github.com/square/crossfilter/wiki/API-Reference#wiki-dimension). If the value is given,
    then it will be used as the new dimension.

    If no value specified then the current dimension will be returned.

    **/
    _chart.dimension = function (d) {
        if (!arguments.length) return _dimension;
        _dimension = d;
        _chart.expireCache();
        return _chart;
    };

    _chart.data = function(d) {
        if (!arguments.length) return _data.call(_chart,_group);
        _data = d3.functor(d);
        _chart.expireCache();
        return _chart;
    };

    /**
    #### .group([value, [name]]) - **mandatory**
    Set or get group attribute of a chart. In dc a group is a
    [crossfilter group](https://github.com/square/crossfilter/wiki/API-Reference#wiki-group). Usually the group should be
    created from the particular dimension associated with the same chart. If the value is given, then it will be used as
    the new group.

    If no value specified then the current group will be returned.
    If name is specified then it will be used to generate legend label.

    **/
    _chart.group = function (g, name) {
        if (!arguments.length) return _group;
        _group = g;
        _chart.expireCache();
        if (typeof name === 'string') _chart._setGroupName(_group, name);
        return _chart;
    };

    // store groups names in the group itself
    // __names__ ->
    //    chart (in referenced by multiple charts) ->
    //        array of accessors, array of names
    function groupName(chart, g, accessor) {
        var c = chart.chartID(),
            k = '__names__';
        if (!accessor || accessor == chart.valueAccessor())
            accessor = "default";
        if (!g[k]) g[k] = {};
        if (!g[k][c]) g[k][c] = {a:[],n:[]};
        var i = g[k][c].a.indexOf(accessor);
        if (i == -1) {
            i = g[k][c].a.length;
            g[k][c].a[i] = accessor;
            g[k][c].n[i] = {name:''};
        }
        return g[k][c].n[i];
    }


    _chart._getGroupName = function (g, accessor) {
        return groupName(_chart, g, accessor).name;
    };

    _chart._setGroupName = function (g, name, accessor) {
        groupName(_chart, g, accessor).name = name;
    };

    /**
    #### .ordering([orderFunction])
    Get or set an accessor to order ordinal charts
    **/
    _chart.ordering = function(o) {
        if (!arguments.length) return _ordering;
        _ordering = o;
        _orderSort = crossfilter.quicksort.by(_ordering);
        _chart.expireCache();
        return _chart;
    };

    _chart.computeOrderedGroups = function(data) {
        if (data.length <= 1)
            return data;
        if (!_orderSort) _orderSort = crossfilter.quicksort.by(_ordering);
        return _orderSort(data,0,data.length);
    };

    /**
    #### .filterAll()
    Clear all filters associated with this chart.

    **/
    _chart.filterAll = function () {
        return _chart.filter(null);
    };

    _chart.dataSet = function () {
        return _dimension !== undefined && _group !== undefined;
    };

    /**
    #### .select(selector)
    Execute in scope d3 single selection using the given selector and return d3 selection result. Roughly the same as:
    ```js
    d3.select("#chart-id").select(selector);
    ```
    This function is **not chainable** since it does not return a chart instance; however the d3 selection result is chainable
    from d3's perspective.

    **/
    _chart.select = function (s) {
        return _root.select(s);
    };

    /**
    #### .selectAll(selector)
    Execute in scope d3 selectAll using the given selector and return d3 selection result. Roughly the same as:
    ```js
    d3.select("#chart-id").selectAll(selector);
    ```
    This function is **not chainable** since it does not return a chart instance; however the d3 selection result is
    chainable from d3's perspective.

    **/
    _chart.selectAll = function (s) {
        return _root ? _root.selectAll(s) : null;
    };

    /**
    #### .anchor([anchorChart/anchorSelector], [chartGroup])
    Set the svg root to either be an existing chart's root or the first element returned from a d3 css string selector. Optionally registers the chart within the chartGroup. This class is called internally on chart initialization, but be called again to relocate the chart. However, it will orphan any previously created SVG elements.

    **/
    _chart.anchor = function (a, chartGroup) {
        if (!arguments.length) return _anchor;
        if (dc.instanceOfChart(a)) {
            _anchor = a.anchor();
            _root = a.root();
        } else {
            _anchor = a;
            _root = d3.select(_anchor);
            _root.classed(dc.constants.CHART_CLASS, true);
            dc.registerChart(_chart, chartGroup);
        }
        _chartGroup = chartGroup;
        return _chart;
    };

    /**
    #### .anchorName()
    Return the dom ID for chart's anchored location

    **/
    _chart.anchorName = function () {
        var a = _chart.anchor();
        if (a && a.id) return a.id;
        if (a && a.replace) return a.replace('#','');
        return "" + _chart.chartID();
    };

    /**
    #### .root([rootElement])
    Returns the root element where a chart resides. Usually it will be the parent div element where svg was created. You
    can also pass in a new root element however this is usually handled as part of the dc internal. Resetting root element
    on a chart outside of dc internal might have unexpected consequences.

    **/
    _chart.root = function (r) {
        if (!arguments.length) return _root;
        _root = r;
        return _chart;
    };

    /**
    #### .svg([svgElement])
    Returns the top svg element for this specific chart. You can also pass in a new svg element however this is usually
    handled as part of the dc internal. Resetting svg element on a chart outside of dc internal might have unexpected
    consequences.

    **/
    _chart.svg = function (_) {
        if (!arguments.length) return _svg;
        _svg = _;
        return _chart;
    };

    /**
    #### .resetSvg()
    Remove the chart's SVG elements from the dom and recreate the container SVG element.
    **/
    _chart.resetSvg = function () {
        _chart.select("svg").remove();
        return generateSvg();
    };

    function generateSvg() {
        _svg = _chart.root().append("svg")
            .attr("width", _chart.width())
            .attr("height", _chart.height());
        return _svg;
    }

    /**
    #### .filterPrinter([filterPrinterFunction])
    Set or get filter printer function. Filter printer function is used to generate human friendly text for filter value(s)
    associated with the chart instance. By default dc charts shipped with a default filter printer implementation dc.printers.filter
    that provides simple printing support for both single value and ranged filters.

    **/
    _chart.filterPrinter = function (_) {
        if (!arguments.length) return _filterPrinter;
        _filterPrinter = _;
        return _chart;
    };

    /**
    #### .turnOnControls() & .turnOffControls()
    Turn on/off optional control elements within the root element. dc.js currently support the following html control elements.

    * root.selectAll(".reset") elements are turned on if the chart has an active filter. This type of control elements are usually used to store reset link to allow user to reset filter on a certain chart. This element will be turned off automatically if the filter is cleared.
    * root.selectAll(".filter") elements are turned on if the chart has an active filter. The text content of this element is then replaced with the current filter value using the filter printer function. This type of element will be turned off automatically if the filter is cleared.

    **/
    _chart.turnOnControls = function () {
        if (_root) {
            _chart.selectAll(".reset").style("display", null);
            _chart.selectAll(".filter").text(_filterPrinter(_chart.filters())).style("display", null);
        }
        return _chart;
    };

    _chart.turnOffControls = function () {
        if (_root) {
            _chart.selectAll(".reset").style("display", "none");
            _chart.selectAll(".filter").style("display", "none").text(_chart.filter());
        }
        return _chart;
    };

    /**
    #### .transitionDuration([duration])
    Set or get animation transition duration(in milliseconds) for specific chart instance. Default duration is 750ms.

    **/
    _chart.transitionDuration = function (d) {
        if (!arguments.length) return _transitionDuration;
        _transitionDuration = d;
        return _chart;
    };

    _chart._mandatoryAttributes = function (_) {
        if (!arguments.length) return _mandatoryAttributes;
        _mandatoryAttributes = _;
        return _chart;
    };

    function checkForMandatoryAttributes(a) {
        if (!_chart[a] || !_chart[a]())
            throw new dc.errors.InvalidStateException("Mandatory attribute chart." + a +
                                                      " is missing on chart[#" + _chart.anchorName() + "]");
    }

    /**
    #### .render()
    Invoke this method will force the chart to re-render everything from scratch. Generally it should be only used to
    render the chart for the first time on the page or if you want to make sure everything is redrawn from scratch instead
    of relying on the default incremental redrawing behaviour.

    **/
    _chart.render = function () {
        _listeners.preRender(_chart);

        if (_mandatoryAttributes)
            _mandatoryAttributes.forEach(checkForMandatoryAttributes);

        var result = _chart.doRender();

        if (_legend) _legend.render();

        _chart.activateRenderlets("postRender");

        return result;
    };

    _chart.activateRenderlets = function (event) {
        if (_chart.transitionDuration() > 0 && _svg) {
            _svg.transition().duration(_chart.transitionDuration())
                .each("end", function () {
                    runAllRenderlets();
                    if (event) _listeners[event](_chart);
                });
        } else {
            runAllRenderlets();
            if (event) _listeners[event](_chart);
        }
    };

    /**
    #### .redraw()
    Calling redraw will cause the chart to re-render delta in data change incrementally. If there is no change in the
    underlying data dimension then calling this method will have no effect on the chart. Most of the chart interaction in
    dc library will automatically trigger this method through its internal event engine, therefore you only need to manually
    invoke this function if data is manipulated outside of dc's control; for example if data is loaded on a periodic basis
    in the background using crossfilter.add().

    **/
    _chart.redraw = function () {
        _listeners.preRedraw(_chart);

        var result = _chart.doRedraw();

        _chart.activateRenderlets("postRedraw");

        return result;
    };

    _chart._invokeFilteredListener = function (f) {
        if (f !== undefined) _listeners.filtered(_chart, f);
    };

    _chart._invokeZoomedListener = function () {
        _listeners.zoomed(_chart);
    };

    /**
    #### .hasFilter([filter])
    Check whether is any active filter or a specific filter is associated with particular chart instance.
    This function is **not chainable**.

    **/
    _chart.hasFilter = function (filter) {
        if (!arguments.length) return _filters.length > 0;
        return _filters.indexOf(filter) >= 0;
    };

    function removeFilter(_) {
        _filters.splice(_filters.indexOf(_), 1);
        applyFilters();
        _chart._invokeFilteredListener(_);
    }

    function addFilter(_) {
        _filters.push(_);
        applyFilters();
        _chart._invokeFilteredListener(_);
    }

    function resetFilters() {
        _filters = [];
        applyFilters();
        _chart._invokeFilteredListener(null);
    }

    function applyFilters() {
        if (_chart.dimension() && _chart.dimension().filter) {
            var fs = _filterHandler(_chart.dimension(), _filters);
            _filters = fs ? fs : _filters;
        }
    }

    /**
    #### .filter([filterValue])
    Filter the chart by the given value or return the current filter if the input parameter is missing.
    ```js
    // filter by a single string
    chart.filter("Sunday");
    // filter by a single age
    chart.filter(18);
    ```

    **/
    _chart.filter = function (_) {
        if (!arguments.length) return _filters.length > 0 ? _filters[0] : null;

        if (_ instanceof Array && _[0] instanceof Array) {
            _[0].forEach(function(d){
                if (_chart.hasFilter(d)) {
                    _filters.splice(_filters.indexOf(d), 1);
                } else {
                    _filters.push(d);
                }
            });
            applyFilters();
            _chart._invokeFilteredListener(_);
        } else if (_ === null) {
            resetFilters();
        } else {
            if (_chart.hasFilter(_))
                removeFilter(_);
            else
                addFilter(_);
        }

        if (_root !== null && _chart.hasFilter()) {
            _chart.turnOnControls();
        } else {
            _chart.turnOffControls();
        }

        return _chart;
    };

    /**
    #### .filters()
    Return all current filters. This method does not perform defensive cloning of the internal filter array before returning
    therefore any modification of returned array will affact chart's internal filter storage.

    **/
    _chart.filters = function () {
        return _filters;
    };

    _chart.highlightSelected = function (e) {
        d3.select(e).classed(dc.constants.SELECTED_CLASS, true);
        d3.select(e).classed(dc.constants.DESELECTED_CLASS, false);
    };

    _chart.fadeDeselected = function (e) {
        d3.select(e).classed(dc.constants.SELECTED_CLASS, false);
        d3.select(e).classed(dc.constants.DESELECTED_CLASS, true);
    };

    _chart.resetHighlight = function (e) {
        d3.select(e).classed(dc.constants.SELECTED_CLASS, false);
        d3.select(e).classed(dc.constants.DESELECTED_CLASS, false);
    };

    _chart.onClick = function (d) {
        var filter = _chart.keyAccessor()(d);
        dc.events.trigger(function () {
            _chart.filter(filter);
            dc.redrawAll(_chart.chartGroup());
        });
    };

    /**
    #### .filterHandler([function])
    Set or get filter handler. Filter handler is a function that performs the filter action on a specific dimension. Using
    custom filter handler give you the flexibility to perform additional logic before or after filtering.

    ```js
    // default filter handler
    function(dimension, filter){
        dimension.filter(filter); // perform filtering
        return filter; // return the actual filter value
    }

    // custom filter handler
    chart.filterHandler(function(dimension, filter){
        var newFilter = filter + 10;
        dimension.filter(newFilter);
        return newFilter; // set the actual filter value to the new value
    });
    ```

    **/
    _chart.filterHandler = function (_) {
        if (!arguments.length) return _filterHandler;
        _filterHandler = _;
        return _chart;
    };

    // abstract function stub
    _chart.doRender = function () {
        // do nothing in base, should be overridden by sub-function
        return _chart;
    };

    _chart.doRedraw = function () {
        // do nothing in base, should be overridden by sub-function
        return _chart;
    };

    _chart.legendables = function () {
        // do nothing in base, should be overridden by sub-function
        return [];
    };

    _chart.legendHighlight = function (d) {
        // do nothing in base, should be overridden by sub-function
    };

    _chart.legendReset = function (d) {
        // do nothing in base, should be overridden by sub-function
    };

    /**
    #### .keyAccessor([keyAccessorFunction])
    Set or get the key accessor function. Key accessor function is used to retrieve key value in crossfilter group. Key
    values are used differently in different charts, for example keys correspond to slices in pie chart and x axis position
    in grid coordinate chart.
    ```js
    // default key accessor
    chart.keyAccessor(function(d) { return d.key; });
    // custom key accessor for a multi-value crossfilter reduction
    chart.keyAccessor(function(p) { return p.value.absGain; });
    ```

    **/
    _chart.keyAccessor = function (_) {
        if (!arguments.length) return _keyAccessor;
        _keyAccessor = _;
        return _chart;
    };

    /**
    #### .valueAccessor([valueAccessorFunction])
    Set or get the value accessor function. Value accessor function is used to retrieve value in crossfilter group. Group
    values are used differently in different charts, for example group values correspond to slices size in pie chart and y
    axis position in grid coordinate chart.
    ```js
    // default value accessor
    chart.valueAccessor(function(d) { return d.value; });
    // custom value accessor for a multi-value crossfilter reduction
    chart.valueAccessor(function(p) { return p.value.percentageGain; });
    ```

    **/
    _chart.valueAccessor = function (_) {
        if (!arguments.length) return _valueAccessor;
        _valueAccessor = _;
        return _chart;
    };

    /**
    #### .label([labelFunction])
    Set or get the label function. Chart class will use this function to render label for each child element in the chart,
    i.e. a slice in a pie chart or a bubble in a bubble chart. Not every chart supports label function for example bar chart
    and line chart do not use this function at all.
    ```js
    // default label function just return the key
    chart.label(function(d) { return d.key; });
    // label function has access to the standard d3 data binding and can get quite complicated
    chart.label(function(d) { return d.data.key + "(" + Math.floor(d.data.value / all.value() * 100) + "%)"; });
    ```

    **/
    _chart.label = function (_) {
        if (!arguments.length) return _label;
        _label = _;
        _renderLabel = true;
        return _chart;
    };

    /**
    #### .renderLabel(boolean)
    Turn on/off label rendering

    **/
    _chart.renderLabel = function (_) {
        if (!arguments.length) return _renderLabel;
        _renderLabel = _;
        return _chart;
    };

    /**
    #### .title([titleFunction])
    Set or get the title function. Chart class will use this function to render svg title(usually interpreted by browser
    as tooltips) for each child element in the chart, i.e. a slice in a pie chart or a bubble in a bubble chart. Almost
    every chart supports title function however in grid coordinate chart you need to turn off brush in order to use title
    otherwise the brush layer will block tooltip trigger.
    ```js
    // default title function just return the key
    chart.title(function(d) { return d.key + ": " + d.value; });
    // title function has access to the standard d3 data binding and can get quite complicated
    chart.title(function(p) {
        return p.key.getFullYear()
            + "\n"
            + "Index Gain: " + numberFormat(p.value.absGain) + "\n"
            + "Index Gain in Percentage: " + numberFormat(p.value.percentageGain) + "%\n"
            + "Fluctuation / Index Ratio: " + numberFormat(p.value.fluctuationPercentage) + "%";
    });
    ```

    **/
    _chart.title = function (_) {
        if (!arguments.length) return _title;
        _title = _;
        _renderTitle = true;
        return _chart;
    };

    /**
    #### .renderTitle(boolean)
    Turn on/off title rendering

    **/
    _chart.renderTitle = function (_) {
        if (!arguments.length) return _renderTitle;
        _renderTitle = _;
        return _chart;
    };

    /**
    #### .renderlet(renderletFunction)
    Renderlet is similar to an event listener on rendering event. Multiple renderlets can be added to an individual chart.
    Every time when chart is rerendered or redrawn renderlet then will be invoked right after the chart finishes its own
    drawing routine hence given you a way to override or modify certain behaviour. Renderlet function accepts the chart
    instance as the only input parameter and you can either rely on dc API or use raw d3 to achieve pretty much any effect.
    ```js
    // renderlet function
    chart.renderlet(function(chart){
        // mix of dc API and d3 manipulation
        chart.select("g.y").style("display", "none");
        // its a closure so you can also access other chart variable available in the closure scope
        moveChart.filter(chart.filter());
    });
    ```

    **/
    _chart.renderlet = function (_) {
        _renderlets.push(_);
        return _chart;
    };

    function runAllRenderlets() {
        for (var i = 0; i < _renderlets.length; ++i) {
            _renderlets[i](_chart);
        }
    }

    _chart.chartGroup = function (_) {
        if (!arguments.length) return _chartGroup;
        _chartGroup = _;
        return _chart;
    };

    /**
    #### .expireCache()
    Expire internal chart cache. dc.js chart cache some data internally on a per chart basis so it can speed up rendering
    and avoid unnecessary calculation however under certain circumstances it might be useful to clear the cache e.g. after
    you invoke crossfilter.add function or if you reset group or dimension post render it is always a good idea to clear
    the cache to make sure charts are rendered properly.

    **/
    _chart.expireCache = function () {
        // do nothing in base, should be overridden by sub-function
        return _chart;
    };

    /**
    #### .legend([dc.legend])
    Attach dc.legend widget to this chart. Legend widget will automatically draw legend labels based on the color setting
    and names associated with each group.

    ```js
    chart.legend(dc.legend().x(400).y(10).itemHeight(13).gap(5))
    ```

    **/
    _chart.legend = function (l) {
        if (!arguments.length) return _legend;
        _legend = l;
        _legend.parent(_chart);
        return _chart;
    };

    /**
    ## <a name="listeners" href="#listeners">#</a> Listeners
    All dc chart instance supports the following listeners.

    #### .on("preRender", function(chart){...})
    This listener function will be invoked before chart rendering.

    #### .on("postRender", function(chart){...})
    This listener function will be invoked after chart finish rendering including all renderlets' logic.

    #### .on("preRedraw", function(chart){...})
    This listener function will be invoked before chart redrawing.

    #### .on("postRedraw", function(chart){...})
    This listener function will be invoked after chart finish redrawing including all renderlets' logic.

    #### .on("filtered", function(chart, filter){...})
    This listener function will be invoked after a filter is applied, added or removed.

    #### .on("zoomed", function(chart, filter){...})
    This listener function will be invoked after a zoom is triggered.

    **/
    _chart.on = function (event, listener) {
        _listeners[event] = listener;
        return _chart;
    };

    _chart.chartID = function () {
        return _chart.__dc_flag__;
    };

    return _chart;
};

/**
## <a name="marginable" href="#marginable">#</a>  Marginable

Marginable is a mixin that provides margin utility functions for both the Row Chart and Coordinate Grid Charts.

**/
dc.marginable = function (_chart) {
    var _margin = {top: 10, right: 50, bottom: 30, left: 30};

    /**
    #### .margins([margins])
    Get or set the margins for a particular coordinate grid chart instance. The margins is stored as an associative Javascript
    array. Default margins: {top: 10, right: 50, bottom: 30, left: 30}.

    The margins can be accessed directly from the getter.
    ```js
    var leftMargin = chart.margins().left; // 30 by default
    chart.margins().left = 50;
    leftMargin = chart.margins().left; // now 50
    ```

    **/
    _chart.margins = function (m) {
        if (!arguments.length) return _margin;
        _margin = m;
        return _chart;
    };

    _chart.effectiveWidth = function () {
        return _chart.width() - _chart.margins().left - _chart.margins().right;
    };

    _chart.effectiveHeight = function () {
        return _chart.height() - _chart.margins().top - _chart.margins().bottom;
    };

    return _chart;
};

/**
## <a name="coordinate-grid-chart" href="#coordinate-grid-chart">#</a> CoordinateGrid Chart [Abstract] < [Color Chart](#color-chart) < [Base Chart](#base-chart)
Coordinate grid chart is an abstract base chart designed to support a number of coordinate grid based concrete chart types,
i.e. bar chart, line chart, and bubble chart.

**/
dc.coordinateGridChart = function (_chart) {
    var GRID_LINE_CLASS = "grid-line";
    var HORIZONTAL_CLASS = "horizontal";
    var VERTICAL_CLASS = "vertical";
    var Y_AXIS_LABEL_CLASS = 'y-axis-label';
    var X_AXIS_LABEL_CLASS = 'x-axis-label';
    var DEFAULT_AXIS_LABLEL_PADDING = 12;

    _chart = dc.colorChart(dc.marginable(dc.baseChart(_chart)));

    _chart.colors(d3.scale.category10());
    _chart._mandatoryAttributes().push('x');

    var _parent;
    var _g;
    var _chartBodyG;

    var _x;
    var _xOriginalDomain;
    var _xAxis = d3.svg.axis();
    var _xUnits = dc.units.integers;
    var _xAxisPadding = 0;
    var _xElasticity = false;
    var _xAxisLabel;
    var _xAxisLabelPadding = 0;

    var _y;
    var _yAxis = d3.svg.axis();
    var _yAxisPadding = 0;
    var _yElasticity = false;
    var _yAxisLabel;
    var _yAxisLabelPadding = 0;

    var _brush = d3.svg.brush();
    var _brushOn = true;
    var _round;

    var _renderHorizontalGridLine = false;
    var _renderVerticalGridLine = false;

    var _refocused = false;
    var _unitCount;

    var _zoomScale = [-10, 100];  // -10 to allow zoom out of the original domain
    var _zoomOutRestrict = true; // restrict zoomOut to the original domain?

    var _rangeChart;
    var _focusChart;

    var _mouseZoomable = false;
    var _clipPadding = 0;

    var _outerRangeBandPadding = 0.5;
    var _rangeBandPadding = 0;

    _chart.rescale = function () {
        _unitCount = undefined;
    };

    /**
    #### .rangeChart([chart])
    Get or set the range selection chart associated with this instance. Setting the range selection chart using this function
    will automatically update its selection brush when the current chart zooms in. In return the given range chart will also
    automatically attach this chart as its focus chart hence zoom in when range brush updates. See the
    [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/) example for this effect in action.

    **/
    _chart.rangeChart = function (_) {
        if (!arguments.length) return _rangeChart;
        _rangeChart = _;
        _rangeChart.focusChart(_chart);
        return _chart;
    };

    /**
    #### .zoomScale([extent])
    Get or set the scale extent for mouse zooms.

    **/
    _chart.zoomScale = function (_) {
        if (!arguments.length) return _zoomScale;
        _zoomScale = _;
        return _chart;
    };

    /**
    #### .zoomOutRestrict([true/false])
    Get or set the a zoom restriction to be limited at the origional extent of the range chart
    **/
    _chart.zoomOutRestrict = function (_) {
        if (!arguments.length) return _zoomOutRestrict;
        _zoomOutRestrict = _;
        return _chart;
    };

    _chart._generateG = function (parent) {
        if (parent === undefined)
            _parent = _chart.svg();
        else
            _parent = parent;

        _g = _parent.append("g");

        _chartBodyG = _g.append("g").attr("class", "chart-body")
            .attr("transform", "translate(" + _chart.margins().left + ", " + _chart.margins().top + ")")
            .attr("clip-path", "url(#" + getClipPathId() + ")");

        return _g;
    };

    /**
    #### .g([gElement])
    Get or set the root g element. This method is usually used to retrieve the g element in order to overlay custom svg drawing
    programatically. **Caution**: The root g element is usually generated by dc.js internals, and resetting it might produce unpredictable result.

    **/
    _chart.g = function (_) {
        if (!arguments.length) return _g;
        _g = _;
        return _chart;
    };

    /**
    #### .mouseZoomable([boolean])
    Set or get mouse zoom capability flag (default: false). When turned on the chart will be zoomable through mouse wheel
     . If range selector chart is also attached zooming will also update the range selection brush on associated range
     selector chart.

    **/
    _chart.mouseZoomable = function (z) {
        if (!arguments.length) return _mouseZoomable;
        _mouseZoomable = z;
        return _chart;
    };

    /**
    #### .chartBodyG()
    Retreive the svg group for the chart body.
    **/
    _chart.chartBodyG = function (_) {
        if (!arguments.length) return _chartBodyG;
        _chartBodyG = _;
        return _chart;
    };

    /**
    #### .x([xScale]) - **mandatory**
    Get or set the x scale. x scale could be any [d3 quatitive scales](https://github.com/mbostock/d3/wiki/Quantitative-Scales).
    For example a time scale for histogram or a linear/ordinal scale for visualizing data distribution.
    ```js
    // set x to a linear scale
    chart.x(d3.scale.linear().domain([-2500, 2500]))
    // set x to a time scale to generate histogram
    chart.x(d3.time.scale().domain([new Date(1985, 0, 1), new Date(2012, 11, 31)]))
    ```

    **/
    _chart.x = function (_) {
        if (!arguments.length) return _x;
        _x = _;
        _xOriginalDomain = _x.domain();
        return _chart;
    };

    _chart.xOriginalDomain = function () {
        return _xOriginalDomain;
    };

    /**
    #### .xUnits([xUnits function])
    Set or get the xUnits function. xUnits function is the coordinate grid chart uses to calculate number of data
    projections on x axis such as number bars for a bar chart and number of dots for a line chart. This function is
    expected to return an Javascript array of all data points on x axis. d3 time range functions d3.time.days, d3.time.months,
    and d3.time.years are all valid xUnits function. dc.js also provides a few units function, see [Utilities](#util)
    section for a list of built-in units functions. Default xUnits function is dc.units.integers.
    ```js
    // set x units to day for a histogram
    chart.xUnits(d3.time.days);
    // set x units to month for a histogram
    chart.xUnits(d3.time.months);
    ```
    Custom xUnits function can be easily created using as long as it follows the following inteface:
    ```js
    // units in integer
    function(start, end, xDomain) {
        // simply calculates how many integers in the domain
        return Math.abs(end - start);
    };

    // fixed units
    function(start, end, xDomain) {
        // be aware using fixed units will disable the focus/zoom ability on the chart
        return 1000;
    };
    ```

    **/
    _chart.xUnits = function (_) {
        if (!arguments.length) return _xUnits;
        _xUnits = _;
        return _chart;
    };

    /**
    #### .xAxis([xAxis])
    Set or get the x axis used by a particular coordinate grid chart instance. This function is most useful when certain x
    axis customization is required. x axis in dc.js is simply an instance of
    [d3 axis object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-_axis) therefore it supports any valid d3 axis
    manipulation. **Caution**: The x axis is typically generated by dc chart internal, resetting it might cause unexpected
    outcome.
    ```js
    // customize x axis tick format
    chart.xAxis().tickFormat(function(v) {return v + "%";});
    // customize x axis tick values
    chart.xAxis().tickValues([0, 100, 200, 300]);
    ```

    **/
    _chart.xAxis = function (_) {
        if (!arguments.length) return _xAxis;
        _xAxis = _;
        return _chart;
    };

    /**
    #### .elasticX([boolean])
    Turn on/off elastic x axis. If x axis elasticity is turned on, then the grid chart will attempt to generate and
    recalculate x axis range whenever redraw event is triggered.

    **/
    _chart.elasticX = function (_) {
        if (!arguments.length) return _xElasticity;
        _xElasticity = _;
        return _chart;
    };

    /**
    #### .xAxisPadding([padding])
    Set or get x axis padding when elastic x axis is turned on. The padding will be added to both end of the x axis if and
    only if elasticX is turned on otherwise it will be simply ignored.

    * padding - could be integer or percentage in string (e.g. "10%"). Padding can be applied to number or date.
    When padding with date, integer represents number of days being padded while percentage string will be treated
    as number.

    **/
    _chart.xAxisPadding = function (_) {
        if (!arguments.length) return _xAxisPadding;
        _xAxisPadding = _;
        return _chart;
    };

    _chart.xUnitCount = function () {
        if (_unitCount === undefined) {
            var units = _chart.xUnits()(_chart.x().domain()[0], _chart.x().domain()[1], _chart.x().domain());

            if (units instanceof Array)
                _unitCount = units.length;
            else
                _unitCount = units;
        }

        return _unitCount;
    };

    _chart.isOrdinal = function () {
        return _chart.xUnits() === dc.units.ordinal;
    };

    function prepareXAxis(g) {
        if (_chart.elasticX() && !_chart.isOrdinal()) {
            _x.domain([_chart.xAxisMin(), _chart.xAxisMax()]);
        }
        else if (_chart.isOrdinal() && _x.domain().length===0) {
            var orderedData = _chart.computeOrderedGroups(_chart.data());
            _x.domain(orderedData.map(_chart.keyAccessor()));
        }

        if (_chart.isOrdinal()) {
            _x.rangeBands([0,_chart.xAxisLength()],_rangeBandPadding,_outerRangeBandPadding);
        } else {
            _x.range([0, _chart.xAxisLength()]);
        }

        _xAxis = _xAxis.scale(_chart.x()).orient("bottom");

        renderVerticalGridLines(g);
    }

    _chart.renderXAxis = function (g) {
        var axisXG = g.selectAll("g.x");

        if (axisXG.empty())
            axisXG = g.append("g")
                .attr("class", "axis x")
                .attr("transform", "translate(" + _chart.margins().left + "," + _chart.xAxisY() + ")");

        var axisXLab = g.selectAll("text."+X_AXIS_LABEL_CLASS);
        if (axisXLab.empty() && _chart.xAxisLabel())
            axisXLab = g.append('text')
                .attr("transform", "translate(" + (_chart.margins().left + _chart.xAxisLength() / 2) + "," + (_chart.height() - _xAxisLabelPadding) + ")")
                .attr('class', X_AXIS_LABEL_CLASS)
                .attr('text-anchor', 'middle')
                .text(_chart.xAxisLabel());
        if (_chart.xAxisLabel() && axisXLab.text() != _chart.xAxisLabel())
            axisYLab.text(_chart.xAxisLabel());

        dc.transition(axisXG, _chart.transitionDuration())
            .call(_xAxis);
    };

    function renderVerticalGridLines(g) {
        var gridLineG = g.selectAll("g." + VERTICAL_CLASS);

        if (_renderVerticalGridLine) {
            if (gridLineG.empty())
                gridLineG = g.insert("g", ":first-child")
                    .attr("class", GRID_LINE_CLASS + " " + VERTICAL_CLASS)
                    .attr("transform", "translate(" + _chart.yAxisX() + "," + _chart.margins().top + ")");

            var ticks = _xAxis.tickValues() ? _xAxis.tickValues() : _x.ticks(_xAxis.ticks()[0]);

            var lines = gridLineG.selectAll("line")
                .data(ticks);

            // enter
            var linesGEnter = lines.enter()
                .append("line")
                .attr("x1", function (d) {
                    return _x(d);
                })
                .attr("y1", _chart.xAxisY() - _chart.margins().top)
                .attr("x2", function (d) {
                    return _x(d);
                })
                .attr("y2", 0)
                .attr("opacity", 0);
            dc.transition(linesGEnter, _chart.transitionDuration())
                .attr("opacity", 1);

            // update
            dc.transition(lines, _chart.transitionDuration())
                .attr("x1", function (d) {
                    return _x(d);
                })
                .attr("y1", _chart.xAxisY() - _chart.margins().top)
                .attr("x2", function (d) {
                    return _x(d);
                })
                .attr("y2", 0);

            // exit
            lines.exit().remove();
        }
        else {
            gridLineG.selectAll("line").remove();
        }
    }

    _chart.xAxisY = function () {
        return (_chart.height() - _chart.margins().bottom);
    };

    _chart.xAxisLength = function () {
        return _chart.effectiveWidth();
    };

    _chart.xAxisLabel = function (_,pad) {
        if (!arguments.length) return _xAxisLabel;
        _xAxisLabel = _;
        _chart.margins().bottom -= _xAxisLabelPadding;
        _xAxisLabelPadding = (pad===undefined) ? DEFAULT_AXIS_LABLEL_PADDING : pad;
        _chart.margins().bottom += _xAxisLabelPadding;
        return _chart;
    };

    function prepareYAxis(g) {
        if (_y === undefined || _chart.elasticY()) {
            _y = d3.scale.linear();
            _y.domain([_chart.yAxisMin(), _chart.yAxisMax()]).rangeRound([_chart.yAxisHeight(), 0]);
        }

        _y.range([_chart.yAxisHeight(), 0]);
        _yAxis = _yAxis.scale(_y).orient("left");

        renderHorizontalGridLines(g);
    }

    _chart.renderYAxis = function (g) {
        var axisYG = g.selectAll("g.y");
        if (axisYG.empty())
            axisYG = g.append("g")
                .attr("class", "axis y")
                .attr("transform", "translate(" + _chart.yAxisX() + "," + _chart.margins().top + ")");

        var axisYLab = g.selectAll("text."+Y_AXIS_LABEL_CLASS);
        if (axisYLab.empty() && _chart.yAxisLabel())
            axisYLab = g.append('text')
                .attr("transform", "translate(" + _yAxisLabelPadding + "," + (_chart.margins().top + _chart.yAxisHeight()/2) + "),rotate(-90)")
                .attr('class', Y_AXIS_LABEL_CLASS)
                .attr('text-anchor', 'middle')
                .text(_chart.yAxisLabel());
        if (_chart.yAxisLabel() && axisYLab.text() != _chart.yAxisLabel())
            axisYLab.text(_chart.yAxisLabel());

        dc.transition(axisYG, _chart.transitionDuration())
            .call(_yAxis);
    };


    function renderHorizontalGridLines(g) {
        var gridLineG = g.selectAll("g." + HORIZONTAL_CLASS);

        if (_renderHorizontalGridLine) {
            var ticks = _yAxis.tickValues() ? _yAxis.tickValues() : _y.ticks(_yAxis.ticks()[0]);

            if (gridLineG.empty())
                gridLineG = g.insert("g", ":first-child")
                    .attr("class", GRID_LINE_CLASS + " " + HORIZONTAL_CLASS)
                    .attr("transform", "translate(" + _chart.yAxisX() + "," + _chart.margins().top + ")");

            var lines = gridLineG.selectAll("line")
                .data(ticks);

            // enter
            var linesGEnter = lines.enter()
                .append("line")
                .attr("x1", 1)
                .attr("y1", function (d) {
                    return _y(d);
                })
                .attr("x2", _chart.xAxisLength())
                .attr("y2", function (d) {
                    return _y(d);
                })
                .attr("opacity", 0);
            dc.transition(linesGEnter, _chart.transitionDuration())
                .attr("opacity", 1);

            // update
            dc.transition(lines, _chart.transitionDuration())
                .attr("x1", 1)
                .attr("y1", function (d) {
                    return _y(d);
                })
                .attr("x2", _chart.xAxisLength())
                .attr("y2", function (d) {
                    return _y(d);
                });

            // exit
            lines.exit().remove();
        }
        else {
            gridLineG.selectAll("line").remove();
        }
    }

    _chart.yAxisX = function () {
        return _chart.margins().left;
    };

    _chart.yAxisLabel = function (_,pad) {
        if (!arguments.length) return _yAxisLabel;
        _yAxisLabel = _;
        _chart.margins().left -= _yAxisLabelPadding;
        _yAxisLabelPadding = (pad===undefined) ? DEFAULT_AXIS_LABLEL_PADDING : pad;
        _chart.margins().left += _yAxisLabelPadding;
        return _chart;
    };

    /**
    #### .y([yScale])
    Get or set the y scale. y scale is typically automatically generated by the chart implementation.

    **/
    _chart.y = function (_) {
        if (!arguments.length) return _y;
        _y = _;
        return _chart;
    };

    /**
    #### .yAxis([yAxis])
    Set or get the y axis used by a particular coordinate grid chart instance. This function is most useful when certain y
    axis customization is required. y axis in dc.js is simply an instance
    of [d3 axis object](https://github.com/mbostock/d3/wiki/SVG-Axes#wiki-_axis) therefore it supports any valid d3 axis
    manipulation. **Caution**: The y axis is typically generated by dc chart internal, resetting it might cause unexpected
    outcome.
    ```js
    // customize y axis tick format
    chart.yAxis().tickFormat(function(v) {return v + "%";});
    // customize y axis tick values
    chart.yAxis().tickValues([0, 100, 200, 300]);
    ```

    **/
    _chart.yAxis = function (y) {
        if (!arguments.length) return _yAxis;
        _yAxis = y;
        return _chart;
    };

    /**
    #### .elasticY([boolean])
    Turn on/off elastic y axis. If y axis elasticity is turned on, then the grid chart will attempt to generate and recalculate
    y axis range whenever redraw event is triggered.

    **/
    _chart.elasticY = function (_) {
        if (!arguments.length) return _yElasticity;
        _yElasticity = _;
        return _chart;
    };

    /**
    #### .renderHorizontalGridLines([boolean])
    Turn on/off horizontal grid lines.

    **/
    _chart.renderHorizontalGridLines = function (_) {
        if (!arguments.length) return _renderHorizontalGridLine;
        _renderHorizontalGridLine = _;
        return _chart;
    };

    /**
    #### .renderVerticalGridLines([boolean])
    Turn on/off vertical grid lines.

    **/
    _chart.renderVerticalGridLines = function (_) {
        if (!arguments.length) return _renderVerticalGridLine;
        _renderVerticalGridLine = _;
        return _chart;
    };

    _chart.xAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.keyAccessor()(e);
        });
        return dc.utils.subtract(min, _xAxisPadding);
    };

    _chart.xAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.keyAccessor()(e);
        });
        return dc.utils.add(max, _xAxisPadding);
    };

    _chart.yAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.valueAccessor()(e);
        });
        return dc.utils.subtract(min, _yAxisPadding);
    };

    _chart.yAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.valueAccessor()(e);
        });
        return dc.utils.add(max, _yAxisPadding);
    };

    /**
    #### .yAxisPadding([padding])
    if elasticY is turned on otherwise it will be simply ignored.
    Set or get y axis padding when elastic y axis is turned on. The padding will be added to the top of the y axis if and only

    * padding - could be integer or percentage in string (e.g. "10%"). Padding can be applied to number or date.
    When padding with date, integer represents number of days being padded while percentage string will be treated
    as number.

    **/
    _chart.yAxisPadding = function (_) {
        if (!arguments.length) return _yAxisPadding;
        _yAxisPadding = _;
        return _chart;
    };

    _chart.yAxisHeight = function () {
        return _chart.effectiveHeight();
    };

    /**
    #### .round([rounding function])
    Set or get the rounding function for x axis. Rounding is mainly used to provide stepping capability when in place
    selection based filter is enable.
    ```js
    // set x unit round to by month, this will make sure range selection brash will
    // extend on a month-by-month basis
    chart.round(d3.time.month.round);
    ```

    **/
    _chart.round = function (_) {
        if (!arguments.length) return _round;
        _round = _;
        return _chart;
    };

    _chart._rangeBandPadding = function (_) {
        if (!arguments.length) return _rangeBandPadding;
        _rangeBandPadding = _;
        return _chart;
    };

    _chart._outerRangeBandPadding = function (_) {
        if (!arguments.length) return _outerRangeBandPadding;
        _outerRangeBandPadding = _;
        return _chart;
    };

    dc.override(_chart, "filter", function (_) {
        if (!arguments.length) return _chart._filter();

        _chart._filter(_);

        if (_) {
            _chart.brush().extent(_);
        } else {
            _chart.brush().clear();
        }

        return _chart;
    });

    _chart.brush = function (_) {
        if (!arguments.length) return _brush;
        _brush = _;
        return _chart;
    };

    function brushHeight() {
        return _chart.xAxisY() - _chart.margins().top;
    }

    _chart.renderBrush = function (g) {
        if (_chart.isOrdinal())
            _brushOn = false;

        if (_brushOn) {
            _brush.on("brush", _chart._brushing);

            var gBrush = g.append("g")
                .attr("class", "brush")
                .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")")
                .call(_brush.x(_chart.x()));
            gBrush.selectAll("rect").attr("height", brushHeight());
            gBrush.selectAll(".resize").append("path").attr("d", _chart.resizeHandlePath);

            if (_chart.hasFilter()) {
                _chart.redrawBrush(g);
            }
        }
    };

    _chart.extendBrush = function () {
        var extent = _brush.extent();
        if (_chart.round()) {
            extent[0] = extent.map(_chart.round())[0];
            extent[1] = extent.map(_chart.round())[1];

            _g.select(".brush")
                .call(_brush.extent(extent));
        }
        return extent;
    };

    _chart.brushIsEmpty = function (extent) {
        return _brush.empty() || !extent || extent[1] <= extent[0];
    };

    _chart._brushing = function() {
        var extent = _chart.extendBrush();

        _chart.redrawBrush(_g);

        if (_chart.brushIsEmpty(extent)) {
            dc.events.trigger(function () {
                _chart.filter(null);
                dc.redrawAll(_chart.chartGroup());
            });
        } else {
            dc.events.trigger(function () {
                _chart.filter(null);
                _chart.filter([extent[0], extent[1]]);
                dc.redrawAll(_chart.chartGroup());
            }, dc.constants.EVENT_DELAY);
        }
    };

    _chart.redrawBrush = function (g) {
        if (_brushOn) {
            if (_chart.filter() && _chart.brush().empty())
                _chart.brush().extent(_chart.filter());

            var gBrush = g.select("g.brush");
            gBrush.call(_chart.brush().x(_chart.x()));
            gBrush.selectAll("rect").attr("height", brushHeight());
        }

        _chart.fadeDeselectedArea();
    };

    _chart.fadeDeselectedArea = function () {
        // do nothing, sub-chart should override this function
    };

    // borrowed from Crossfilter example
    _chart.resizeHandlePath = function (d) {
        var e = +(d == "e"), x = e ? 1 : -1, y = brushHeight() / 3;
        /*jshint -W014 */
        return "M" + (0.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (2 * y - 6)
            + "A6,6 0 0 " + e + " " + (0.5 * x) + "," + (2 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (2 * y - 8);
        /*jshint +W014 */
    };

    function getClipPathId() {
        return _chart.anchorName() + "-clip";
    }

    /**
    #### .clipPadding([padding])
    Get or set padding in pixel for clip path. Once set padding will be applied evenly to top, left, right, and bottom padding
     when clip path is generated. If set to zero, then the clip area will be exactly the chart body area minus the margins.
     Default: 5

    **/
    _chart.clipPadding = function (p) {
        if (!arguments.length) return _clipPadding;
        _clipPadding = p;
        return _chart;
    };

    function generateClipPath() {
        var defs = dc.utils.appendOrSelect(_parent, "defs");

        var chartBodyClip = dc.utils.appendOrSelect(defs, "clipPath").attr("id", getClipPathId());

        var padding = _clipPadding * 2;

        dc.utils.appendOrSelect(chartBodyClip, "rect")
            .attr("width", _chart.xAxisLength() + padding)
            .attr("height", _chart.yAxisHeight() + padding);
    }

    _chart._preprocessData = function() {};

    _chart.doRender = function () {
        _chart.resetSvg();

        _chart._preprocessData();

        _chart._generateG();
        generateClipPath();
        prepareXAxis(_chart.g());
        prepareYAxis(_chart.g());

        _chart.plotData();

        _chart.renderXAxis(_chart.g());
        _chart.renderYAxis(_chart.g());

        _chart.renderBrush(_chart.g());

        enableMouseZoom();

        return _chart;
    };

    function enableMouseZoom() {
        if (_mouseZoomable) {
            _chart.root().call(d3.behavior.zoom()
                .x(_chart.x())
                .scaleExtent(_zoomScale)
                .on("zoom", function () {
                    _chart.focus(_chart.x().domain());
                    _chart._invokeZoomedListener();
                    updateRangeSelChart();
                }));
        }
    }

    function updateRangeSelChart() {
        if (_rangeChart) {
            var refDom = _chart.x().domain();
            if (_zoomOutRestrict) {
                var origDom = _rangeChart.xOriginalDomain();
                var newDom = [
                    refDom[0] < origDom[0] ? refDom[0] : origDom[0],
                    refDom[1] > origDom[1] ? refDom[1] : origDom[1]
                ];
                _rangeChart.focus(newDom);
            } else {
                _rangeChart.focus(refDom);
            }
            _rangeChart.filter(null);
            _rangeChart.filter(refDom);

            dc.events.trigger(function () {
                dc.redrawAll(_chart.chartGroup());
            });
        }
    }

    _chart.doRedraw = function () {
        _chart._preprocessData();
        prepareXAxis(_chart.g());
        prepareYAxis(_chart.g());

        _chart.plotData();

        if (_chart.elasticY())
            _chart.renderYAxis(_chart.g());

        if (_chart.elasticX() || _refocused)
            _chart.renderXAxis(_chart.g());

        _chart.redrawBrush(_chart.g());

        return _chart;
    };

    _chart.subRender = function () {
        _chart.plotData();

        return _chart;
    };

    /**
    #### .brushOn([boolean])
    Turn on/off the brush based in-place range filter. When the brush is on then user will be able to  simply drag the mouse
    across the chart to perform range filtering based on the extend of the brush. However turning on brush filter will essentially
    disable other interactive elements on the chart such as the highlighting, tool-tip, and reference lines on a chart. Default
    value is "true".

    **/
    _chart.brushOn = function (_) {
        if (!arguments.length) return _brushOn;
        _brushOn = _;
        return _chart;
    };

    function hasRangeSelected(range) {
        return range instanceof Array && range.length > 1;
    }

    /**
    #### .focus([range])
    Zoom this chart to focus on the given range. The given range should be an array containing only 2 element([start, end]) defining an range in x domain. If the range is not given or set to null, then the zoom will be reset. _For focus to work elasticX has to be turned off otherwise focus will be ignored._
    ```js
    chart.renderlet(function(chart){
        // smooth the rendering through event throttling
        dc.events.trigger(function(){
            // focus some other chart to the range selected by user on this chart
            someOtherChart.focus(chart.filter());
        });
    })
    ```

    **/
    _chart.focus = function (range) {
        _refocused = true;

        if (hasRangeSelected(range)) {
            _chart.x().domain(range);
        } else {
            _chart.x().domain(_chart.xOriginalDomain());
        }

        _chart.rescale();

        _chart.redraw();

        if (!hasRangeSelected(range))
            _refocused = false;
    };

    _chart.refocused = function () {
        return _refocused;
    };

    _chart.focusChart = function (c) {
        if (!arguments.length) return _focusChart;
        _focusChart = c;
        _chart.on("filtered", function (chart) {
            dc.events.trigger(function () {
                _focusChart.focus(chart.filter());
                _focusChart.filter(chart.filter());
                dc.redrawAll(chart.chartGroup());
            });
        });
        return _chart;
    };

    return _chart;
};

/**
## <a name="color-chart" href="#color-chart">#</a> Color Chart [Abstract]
Color chart is an abstract chart functional class created to provide universal coloring support as a mix-in for any concrete
chart implementation.

**/

dc.colorChart = function(_chart) {
    var _colors = d3.scale.category20c();

    var _colorAccessor = function(d) { return _chart.keyAccessor()(d); };

    var _colorCalculator = function(value) {
        return _colors(value,_chart);
    };

    /**
    #### .colors([colorScale])
    Retrieve current color scale or set a new color scale. This methods accepts any
    function the operate like a d3 scale. If not set the default is
    `d3.scale.category20c()`.
    ```js
    // alternate categorical scale
    chart.colors(d3.scale.category20b());

    // ordinal scale
    chart.colors(d3.scale.ordinal().range(['red','green','blue']);
    // convience method, the same as above
    chart.ordinalColors(['red','green','blue']);

    // set a linear scale
    chart.linearColors(["#4575b4", "#ffffbf", "#a50026"]);
    ```
    **/
    _chart.colors = function(_) {
        if (!arguments.length) return _colors;
        if (_ instanceof Array) _colors = d3.scale.quantize().range(_); // depricated legacy support, note: this fails for ordinal domains
        else _colors = _;
        return _chart;
    };

    /**
    #### .ordinalColors(r)
    Convenience method to set the color scale to d3.scale.ordinal with range `r`.

    **/
    _chart.ordinalColors = function(r) {
        return _chart.colors(d3.scale.ordinal().range(r));
    };

    /**
    #### .linearColors(r)
    Convenience method to set the color scale to an Hcl interpolated linear scale with range `r`.

    **/
    _chart.linearColors = function(r) {
        return _chart.colors(d3.scale.linear()
                             .range(r)
                             .interpolate(d3.interpolateHcl));
    };

    /**
    #### .colorAccessor([colorAccessorFunction])
    Set or get color accessor function. This function will be used to map a data point on crossfilter group to a specific
    color value on the color scale. Default implementation of this function simply returns the next color on the scale using
    the index of a group.
    ```js
    // default index based color accessor
    .colorAccessor(function(d, i){return i;})
    // color accessor for a multi-value crossfilter reduction
    .colorAccessor(function(d){return d.value.absGain;})
    ```
    **/
    _chart.colorAccessor = function(_){
        if(!arguments.length) return _colorAccessor;
        _colorAccessor = _;
        return _chart;
    };

    /**
    #### .colorDomain([domain])
    Set or get the current domain for the color mapping function. The domain must be supplied as an array.

    Note: previously this method accepted a callback function. Instead you may use a custom scale set by `.colors`.

    **/
    _chart.colorDomain = function(_){
        if(!arguments.length) return _colors.domain();
        _colors.domain(_);
        return _chart;
    };

    /**
    #### .calculateColorDomain()
    Set the domain by determining the min and max values as retrived by `.colorAccessor` over the chart's dataset.

    **/
    _chart.calculateColorDomain = function () {
        var newDomain = [d3.min(_chart.data(), _chart.colorAccessor()),
                         d3.max(_chart.data(), _chart.colorAccessor())];
        _colors.domain(newDomain);
    };

    /**
    #### .getColor(d [, i])
    Get the color for the datum d and counter i. This is used internaly by charts to retrieve a color.

    **/
    _chart.getColor = function(d, i){
        return _colorCalculator(_colorAccessor(d, i));
    };

    _chart.colorCalculator = function(_){
        if(!arguments.length) return _colorCalculator;
        _colorCalculator = _;
        return _chart;
    };

    return _chart;
};

/**
## <a name="stackable-chart" href="#stackable-chart">#</a> Stackable Chart [Abstract]
Stackable chart is an abstract chart introduced to provide cross-chart support of stackability. Concrete implementation of
charts can then selectively mix-in this capability.

**/
dc.stackableChart = function (_chart) {
    var _groupStack = new dc.utils.GroupStack();
    var _stackLayout = d3.layout.stack()
        .offset("zero")
        .order("default")
        .values(function (d) {
            return d.points;
        });
    var _allGroups;
    var _allValueAccessors;
    var _allKeyAccessors;
    var _stackLayers;

    /**
    #### .stack(group[, name, accessor])
    Stack a new crossfilter group into this chart with optionally a custom value accessor. All stacks in the same chart will
    share the same key accessor therefore share the same set of keys. In more concrete words, imagine in a stacked bar chart
    all bars will be positioned using the same set of keys on the x axis while stacked vertically. If name is specified then
    it will be used to generate legend label.
    ```js
    // stack group using default accessor
    chart.stack(valueSumGroup)
    // stack group using custom accessor
    .stack(avgByDayGroup, function(d){return d.value.avgByDay;});
    ```

    **/
    _chart.stack = function (group, name, accessor) {
        if(!arguments.length)
            _groupStack.clear();

        _groupStack.setDefaultAccessor(_chart.valueAccessor());

        if (typeof name === 'string') {
            _chart._setGroupName(group, name, accessor);
            _groupStack.addNamedGroup(group, name, accessor);
        }
        else {
            accessor = name;
            _groupStack.addGroup(group, accessor);
        }

        _chart.expireCache();

        return _chart;
    };

    /**
    #### .hideStack(name)
    Hide all stacks on the chart with the given name.
    The chart must be re-rendered for this change to appear.

    **/
    _chart.hideStack = function (stackName) {
        _groupStack.hideGroups(stackName, _chart._getGroupName(_chart.group()) == stackName);
    };

    /**
    #### .showStack(name)
    Show all stacks on the chart with the given name.
    The chart must be re-rendered for this change to appear.

    **/
    _chart.showStack = function (stackName) {
        _groupStack.showGroups(stackName, _chart._getGroupName(_chart.group()) == stackName);
    };

    _chart.expireCache = function () {
        _allGroups = null;
        _allValueAccessors = null;
        _allKeyAccessors = null;
        _stackLayers = null;
        return _chart;
    };

    _chart.allGroups = function () {
        if (_allGroups === null) {
            _allGroups = [];

            _allGroups.push(_chart.group());

            for (var i = 0; i < _groupStack.size(); ++i)
                _allGroups.push(_groupStack.getGroupByIndex(i));
        }

        return _allGroups;
    };

    _chart.allValueAccessors = function () {
        if (_allValueAccessors === null) {
            _allValueAccessors = [];

            _allValueAccessors.push(_chart.valueAccessor());

            for (var i = 0; i < _groupStack.size(); ++i)
                _allValueAccessors.push(_groupStack.getAccessorByIndex(i));
        }

        return _allValueAccessors;
    };

    _chart.getValueAccessorByIndex = function (groupIndex) {
        return _chart.allValueAccessors()[groupIndex];
    };

    _chart.yAxisMin = function () {
        var min, all = flattenStack();

        min = d3.min(all, function (p) {
            return  (p.y + p.y0 < p.y0) ? (p.y + p.y0) : p.y0;
        });

        min = dc.utils.subtract(min, _chart.yAxisPadding());

        return min;
    };

    _chart.yAxisMax = function () {
        var max, all = flattenStack();

        max = d3.max(all, function (p) {
            return p.y + p.y0;
        });

        max = dc.utils.add(max, _chart.yAxisPadding());

        return max;
    };

    function flattenStack() {
        var all = [];

        if (_chart.x()) {
            var xDomain = _chart.x().domain();
            var test;
            if(_chart.isOrdinal()) {
                var domainSet = d3.set(xDomain);
                test = function(p) {
                    return domainSet.has(p.x);
                };
            }
            else {
                test = function(p) {
                    return p.x >= xDomain[0] && p.x <= xDomain[xDomain.length-1];
                };
            }
            _chart.stackLayers().forEach(function (e) {
                e.points.forEach(function (p) {
                    if (test(p))
                        all.push(p);
                });
            });
        } else {
            _chart.stackLayers().forEach(function (e) {
                all = all.concat(e.points);
            });
        }

        return all;
    }

    _chart.allKeyAccessors = function () {
        if (_allKeyAccessors === null) {
            _allKeyAccessors = [];

            _allKeyAccessors.push(_chart.keyAccessor());

            for (var i = 0; i < _groupStack.size(); ++i)
                _allKeyAccessors.push(_chart.keyAccessor());
        }

        return _allKeyAccessors;
    };

    _chart.getKeyAccessorByIndex = function (groupIndex) {
        return _chart.allKeyAccessors()[groupIndex];
    };

    _chart.xAxisMin = function () {
        var min = _chart.allGroups().reduce(function(min,group,groupIndex) {
            var m = dc.utils.groupMin(group, _chart.getKeyAccessorByIndex(groupIndex));
            return (min === null || min > m) ? m : min;
        },null);

        return dc.utils.subtract(min, _chart.xAxisPadding());
    };

    _chart.xAxisMax = function () {
        var max = _chart.allGroups().reduce(function(max,group,groupIndex) {
            var m = dc.utils.groupMax(group, _chart.getKeyAccessorByIndex(groupIndex));
            return (max === null || max < m) ? m : max;
        },null);

        return dc.utils.add(max, _chart.xAxisPadding());
    };

    function calculateDataPointMatrix(group, groupIndex) {
        group.all().forEach(function(d, dataIndex) {
            var key = _chart.getKeyAccessorByIndex(groupIndex)(d);
            var value = _chart.getValueAccessorByIndex(groupIndex)(d);
            _groupStack.setDataPoint(groupIndex, dataIndex, {data: d, x: key, y: value, layer: groupIndex});
        });
    }

    _chart.calculateDataPointMatrixForAll = function () {
        _groupStack.clearDataLayers();
        _chart.allGroups().forEach(calculateDataPointMatrix);
    };

    _chart.getChartStack = function () {
        return _groupStack;
    };

    dc.override(_chart, "valueAccessor", function (_) {
        if (!arguments.length) return _chart._valueAccessor();
        _chart.expireCache();
        return _chart._valueAccessor(_);
    });

    dc.override(_chart, "keyAccessor", function (_) {
        if (!arguments.length) return _chart._keyAccessor();
        _chart.expireCache();
        return _chart._keyAccessor(_);
    });

    /**
     #### .title([stackName], [titleFunction])
     Set or get the title function. Chart class will use this function to render svg title (usually interpreted by browser
     as tooltips) for each child element in the chart, i.e. a slice in a pie chart or a bubble in a bubble chart. Almost
     every chart supports title function however in grid coordinate chart you need to turn off brush in order to use title
     otherwise the brush layer will block tooltip trigger.

     If the first argument is a stack name, the title function will get or set the title for that stack. If stackName
     is not provided, the first stack is implied.
     ```js
     // set a title function on "first stack"
     chart.title("first stack", function(d) { return d.key + ": " + d.value; });
     // get a title function from "second stack"
     var secondTitleFunction = chart.title("second stack");
    });
     ```

     **/
    dc.override(_chart, "title", function (stackName, titleAccessor) {
        if (!stackName) return _chart._title();

        var firstStack = _chart.group() && stackName === _chart._getGroupName(_chart.group());

        if (typeof stackName === 'function') {
            return _chart._title(stackName);
        }
        else if (!titleAccessor) {
            if (firstStack)
                return _chart._title();
            else
                return _groupStack.getTitle(stackName);
        }

        if (firstStack)
            return _chart._title(titleAccessor);
        else
            _groupStack.setTitle(stackName, titleAccessor);

        return _chart;
    });

    _chart.getTitleByIndex = function (index) {
        if (index === 0) {
            return _chart.title();
        }
        else {
            var stackTitle = _chart.title(_groupStack.getNameByIndex(index - 1));
            return stackTitle || _chart.title();
        }
    };

    _chart.stackLayout = function (stack) {
        if (!arguments.length) return _stackLayout;
        _stackLayout = stack;
        return _chart;
    };

    _chart.stackLayers = function (_) {
        if (!arguments.length) {
            if (_stackLayers === null) {
                _chart.calculateDataPointMatrixForAll();
                _stackLayers = _chart.stackLayout()(_groupStack.toLayers());
            }
            return _stackLayers;
        } else {
            _stackLayers = _;
        }
    };

    _chart._layerColorAccessor = function(d){return d.layer === undefined ? d.index : d.layer;};
    _chart.colorAccessor(_chart._layerColorAccessor);

    _chart.legendables = function () {
        return _chart.allGroups().map(function (g, i) {
            return dc.utils.createLegendable(_chart, g, _chart.getValueAccessorByIndex(i), _chart.colorCalculator()(i));
        });
    };

    return _chart;
};

/**
## <a name="abstract-bubble-chart" href="#abstract-bubble-chart">#</a> Abstract Bubble Chart [Abstract] < [Color Chart](#color-chart)
An abstraction provides reusable functionalities for any chart that needs to visualize data using bubbles.

**/
dc.abstractBubbleChart = function (_chart) {
    var _maxBubbleRelativeSize = 0.3;
    var _minRadiusWithLabel = 10;

    _chart.BUBBLE_NODE_CLASS = "node";
    _chart.BUBBLE_CLASS = "bubble";
    _chart.MIN_RADIUS = 10;

    _chart = dc.colorChart(_chart);

    _chart.renderLabel(true);
    _chart.renderTitle(false);

    _chart.data(function(group) {
        return group.top(Infinity);
    });

    var _r = d3.scale.linear().domain([0, 100]);

    var _rValueAccessor = function (d) {
        return d.r;
    };

    /**
    #### .r([bubbleRadiusScale])
    Get or set bubble radius scale. By default bubble chart uses ```d3.scale.linear().domain([0, 100])``` as it's r scale .

    **/
    _chart.r = function (_) {
        if (!arguments.length) return _r;
        _r = _;
        return _chart;
    };

    /**
    #### .radiusValueAccessor([radiusValueAccessor])
    Get or set the radius value accessor function. The radius value accessor function if set will be used to retrieve data value
    for each and every bubble rendered. The data retrieved then will be mapped using r scale to be used as the actual bubble
    radius. In other words, this allows you to encode a data dimension using bubble size.

    **/
    _chart.radiusValueAccessor = function (_) {
        if (!arguments.length) return _rValueAccessor;
        _rValueAccessor = _;
        return _chart;
    };

    _chart.rMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return _chart.radiusValueAccessor()(e);
        });
        return min;
    };

    _chart.rMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return _chart.radiusValueAccessor()(e);
        });
        return max;
    };

    _chart.bubbleR = function (d) {
        var value = _chart.radiusValueAccessor()(d);
        var r = _chart.r()(value);
        if (isNaN(r) || value <= 0)
            r = 0;
        return r;
    };

    var labelFunction = function (d) {
        return _chart.label()(d);
    };

    var labelOpacity = function (d) {
        return (_chart.bubbleR(d) > _minRadiusWithLabel) ? 1 : 0;
    };

    _chart.doRenderLabel = function (bubbleGEnter) {
        if (_chart.renderLabel()) {
            var label = bubbleGEnter.select("text");

            if (label.empty()) {
                label = bubbleGEnter.append("text")
                    .attr("text-anchor", "middle")
                    .attr("dy", ".3em")
                    .on("click", _chart.onClick);
            }

            label
                .attr("opacity", 0)
                .text(labelFunction);
            dc.transition(label, _chart.transitionDuration())
                .attr("opacity", labelOpacity);
        }
    };

    _chart.doUpdateLabels = function (bubbleGEnter) {
        if (_chart.renderLabel()) {
            var labels = bubbleGEnter.selectAll("text")
                .text(labelFunction);
            dc.transition(labels, _chart.transitionDuration())
                .attr("opacity", labelOpacity);
        }
    };

    var titleFunction = function (d) {
        return _chart.title()(d);
    };

    _chart.doRenderTitles = function (g) {
        if (_chart.renderTitle()) {
            var title = g.select("title");

            if (title.empty())
                g.append("title").text(titleFunction);
        }
    };

    _chart.doUpdateTitles = function (g) {
        if (_chart.renderTitle()) {
            g.selectAll("title").text(titleFunction);
        }
    };

    /**
    #### .minRadiusWithLabel([radius])
    Get or set the minimum radius for label rendering. If a bubble's radius is less than this value then no label will be rendered.
    Default value: 10.

    **/
    _chart.minRadiusWithLabel = function (_) {
        if (!arguments.length) return _minRadiusWithLabel;
        _minRadiusWithLabel = _;
        return _chart;
    };

    /**
    #### .maxBubbleRelativeSize([relativeSize])
    Get or set the maximum relative size of a bubble to the length of x axis. This value is useful when the radius differences among
    different bubbles are too great. Default value: 0.3

    **/
    _chart.maxBubbleRelativeSize = function (_) {
        if (!arguments.length) return _maxBubbleRelativeSize;
        _maxBubbleRelativeSize = _;
        return _chart;
    };

    _chart.fadeDeselectedArea = function () {
        if (_chart.hasFilter()) {
            _chart.selectAll("g." + _chart.BUBBLE_NODE_CLASS).each(function (d) {
                if (_chart.isSelectedNode(d)) {
                    _chart.highlightSelected(this);
                } else {
                    _chart.fadeDeselected(this);
                }
            });
        } else {
            _chart.selectAll("g." + _chart.BUBBLE_NODE_CLASS).each(function (d) {
                _chart.resetHighlight(this);
            });
        }
    };

    _chart.isSelectedNode = function (d) {
        return _chart.hasFilter(d.key);
    };

    _chart.onClick = function (d) {
        var filter = d.key;
        dc.events.trigger(function () {
            _chart.filter(filter);
            dc.redrawAll(_chart.chartGroup());
        });
    };

    return _chart;
};

/**
## <a name="pie-chart" href="#pie-chart">#</a> Pie Chart [Concrete] < [Color Chart](#color-chart) < [Base Chart](#base-chart)
This chart is a concrete pie chart implementation usually used to visualize small number of categorical distributions.
Pie chart implementation uses keyAccessor to generate slices, and valueAccessor to calculate the size of each slice(key)
relatively to the total sum of all values. Slices are ordered by `.ordering` which defaults to sorting by key.

Examples:

* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)

#### dc.pieChart(parent[, chartGroup])
Create a pie chart instance and attach it to the given parent element.

Parameters:

* parent : string - any valid d3 single selector representing typically a dom block element such
   as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created pie chart instance

```js
// create a pie chart under #chart-container1 element using the default global chart group
var chart1 = dc.pieChart("#chart-container1");
// create a pie chart under #chart-container2 element using chart group A
var chart2 = dc.pieChart("#chart-container2", "chartGroupA");
```

**/
dc.pieChart = function (parent, chartGroup) {
    var DEFAULT_MIN_ANGLE_FOR_LABEL = 0.5;

    var _sliceCssClass = "pie-slice";

    var _radius,
        _innerRadius = 0;

    var _g;

    var _minAngleForLabel = DEFAULT_MIN_ANGLE_FOR_LABEL;

    var _chart = dc.capped(dc.colorChart(dc.baseChart({})));

    _chart.colorAccessor(_chart.cappedKeyAccessor);

    _chart.title(function (d) {
        return _chart.cappedKeyAccessor(d) + ": " + _chart.cappedValueAccessor(d);
    });

    /**
    #### .slicesCap([cap])
    Get or set the maximum number of slices the pie chart will generate. The top slices are determined by
    value from high to low. Other slices exeeding the cap will be rolled up into one single *Others* slice.
    The resulting data will still be sorted by .ordering (default by key).

    **/
    _chart.slicesCap = _chart.cap;

    _chart.label(_chart.cappedKeyAccessor);
    _chart.renderLabel(true);

    _chart.transitionDuration(350);

    _chart.doRender = function () {
        _chart.resetSvg();

        _g = _chart.svg()
            .append("g")
            .attr("transform", "translate(" + _chart.cx() + "," + _chart.cy() + ")");

        drawChart();

        return _chart;
    };

    function drawChart() {
        // set radius on basis of chart dimension if missing
        _radius = _radius ? _radius : d3.min([_chart.width(), _chart.height()]) /2;

        var arc = buildArcs();

        var pie = pieLayout();
        var pieData = pie(_chart.data());

        if (_g) {
            var slices = _g.selectAll("g." + _sliceCssClass)
                .data(pieData);

            createElements(slices, arc, pieData);

            updateElements(pieData, arc);

            removeElements(slices);

            highlightFilter();
        }
    }

    function createElements(slices, arc, pieData) {
        var slicesEnter = createSliceNodes(slices);

        createSlicePath(slicesEnter, arc);

        createTitles(slicesEnter);

        createLabels(pieData, arc);
    }

    function createSliceNodes(slices) {
        var slicesEnter = slices
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return _sliceCssClass + " _" + i;
            });
        return slicesEnter;
    }

    function createSlicePath(slicesEnter, arc) {
        var slicePath = slicesEnter.append("path")
            .attr("fill", fill)
            .on("click", onClick)
            .attr("d", function (d, i) {
                return safeArc(d, i, arc);
            });
        slicePath.transition()
            .duration(_chart.transitionDuration())
            .attrTween("d", tweenPie);
    }

    function createTitles(slicesEnter) {
        if (_chart.renderTitle()) {
            slicesEnter.append("title").text(function (d) {
                return _chart.title()(d);
            });
        }
    }

    function createLabels(pieData, arc) {
        if (_chart.renderLabel()) {
            var labels = _g.selectAll("text." + _sliceCssClass)
                .data(pieData);

            labels.exit().remove();

            var labelsEnter = labels
                .enter()
                .append("text")
                .attr("class", function (d, i) {
                    return _sliceCssClass + " _" + i;
                })
                .on("click", onClick);
            dc.transition(labelsEnter, _chart.transitionDuration())
                .attr("transform", function (d) {
                    d.innerRadius = _chart.innerRadius();
                    d.outerRadius = _chart.radius();
                    var centroid = arc.centroid(d);
                    if (isNaN(centroid[0]) || isNaN(centroid[1])) {
                        return "translate(0,0)";
                    } else {
                        return "translate(" + centroid + ")";
                    }
                })
                .attr("text-anchor", "middle")
                .text(function (d) {
                    var data = d.data;
                    if (sliceHasNoData(data) || sliceTooSmall(d))
                        return "";
                    return _chart.label()(d.data);
                });
        }
    }

    function updateElements(pieData, arc) {
        updateSlicePaths(pieData, arc);
        updateLabels(pieData, arc);
        updateTitles(pieData);
    }

    function updateSlicePaths(pieData, arc) {
        var slicePaths = _g.selectAll("g." + _sliceCssClass)
            .data(pieData)
            .select("path")
            .attr("d", function (d, i) {
                return safeArc(d, i, arc);
            });
        dc.transition(slicePaths, _chart.transitionDuration(),
            function (s) {
                s.attrTween("d", tweenPie);
            }).attr("fill", fill);
    }

    function updateLabels(pieData, arc) {
        if (_chart.renderLabel()) {
            var labels = _g.selectAll("text." + _sliceCssClass)
                .data(pieData);
            dc.transition(labels, _chart.transitionDuration())
                .attr("transform", function (d) {
                    d.innerRadius = _innerRadius;
                    d.outerRadius = _radius;
                    var centroid = arc.centroid(d);
                    if (isNaN(centroid[0]) || isNaN(centroid[1])) {
                        return "translate(0,0)";
                    } else {
                        return "translate(" + centroid + ")";
                    }
                })
                .attr("text-anchor", "middle")
                .text(function (d) {
                    var data = d.data;
                    if (sliceHasNoData(data) || sliceTooSmall(d))
                        return "";
                    return _chart.label()(d.data);
                });
        }
    }

    function updateTitles(pieData) {
        if (_chart.renderTitle()) {
            _g.selectAll("g." + _sliceCssClass)
                .data(pieData)
                .select("title")
                .text(function (d) {
                    return _chart.title()(d.data);
                });
        }
    }

    function removeElements(slices) {
        slices.exit().remove();
    }

    function highlightFilter() {
        if (_chart.hasFilter()) {
            _chart.selectAll("g." + _sliceCssClass).each(function (d) {
                if (isSelectedSlice(d)) {
                    _chart.highlightSelected(this);
                } else {
                    _chart.fadeDeselected(this);
                }
            });
        } else {
            _chart.selectAll("g." + _sliceCssClass).each(function (d) {
                _chart.resetHighlight(this);
            });
        }
    }

    /**
    #### .innerRadius([innerRadius])
    Get or set the inner radius on a particular pie chart instance. If inner radius is greater than 0px then the pie chart
    will be essentially rendered as a doughnut chart. Default inner radius is 0px.

    **/
    _chart.innerRadius = function (r) {
        if (!arguments.length) return _innerRadius;
        _innerRadius = r;
        return _chart;
    };

    /**
    #### .radius([radius])
    Get or set the radius on a particular pie chart instance. Default radius is 90px.

    **/
    _chart.radius = function (r) {
        if (!arguments.length) return _radius;
        _radius = r;
        return _chart;
    };

    /**
    #### .cx()
    Get center x coordinate position. This function is **not chainable**.

    **/
    _chart.cx = function () {
        return _chart.width() / 2;
    };

    /**
    #### .cy()
    Get center y coordinate position. This function is **not chainable**.

    **/
    _chart.cy = function () {
        return _chart.height() / 2;
    };

    function buildArcs() {
        return d3.svg.arc().outerRadius(_radius).innerRadius(_innerRadius);
    }

    function isSelectedSlice(d) {
        return _chart.hasFilter(_chart.cappedKeyAccessor(d.data));
    }

    _chart.doRedraw = function () {
        drawChart();
        return _chart;
    };

    /**
    #### .minAngelForLabel([minAngle])
    Get or set the minimal slice angle for label rendering. Any slice with a smaller angle will not render slice label.
    Default min angel is 0.5.
    **/
    _chart.minAngleForLabel = function (_) {
        if (!arguments.length) return _minAngleForLabel;
        _minAngleForLabel = _;
        return _chart;
    };

    function pieLayout() {
        return d3.layout.pie().sort(null).value(_chart.cappedValueAccessor);
    }

    function sliceTooSmall(d) {
        var angle = (d.endAngle - d.startAngle);
        return isNaN(angle) || angle < _minAngleForLabel;
    }

    function sliceHasNoData(d) {
        return _chart.cappedValueAccessor(d) === 0;
    }

    function tweenPie(b) {
        b.innerRadius = _innerRadius;
        var current = this._current;
        if (isOffCanvas(current))
            current = {startAngle: 0, endAngle: 0};
        var i = d3.interpolate(current, b);
        this._current = i(0);
        return function (t) {
            return safeArc(i(t), 0, buildArcs());
        };
    }

    function isOffCanvas(current) {
        return !current || isNaN(current.startAngle) || isNaN(current.endAngle);
    }

    function fill(d, i) {
        return _chart.getColor(d.data, i);
    }

    function onClick(d, i) {
        _chart.onClick(d.data, i);
    }

    function safeArc(d, i, arc) {
        var path = arc(d, i);
        if (path.indexOf("NaN") >= 0)
            path = "M0,0";
        return path;
    }

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="bar-chart" href="#bar-chart">#</a> Bar Chart [Concrete] < [Stackable Chart](#stackable-chart) < [CoordinateGrid Chart](#coordinate-grid-chart)
Concrete bar chart/histogram implementation.

Examples:

* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)
* [Canadian City Crime Stats](http://nickqizhu.github.com/dc.js/crime/index.html)

#### dc.barChart(parent[, chartGroup])
Create a bar chart instance and attach it to the given parent element.

Parameters:
* parent : string|compositeChart - any valid d3 single selector representing typically a dom block element such
   as a div, or if this bar chart is a sub-chart in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created bar chart instance

```js
// create a bar chart under #chart-container1 element using the default global chart group
var chart1 = dc.barChart("#chart-container1");
// create a bar chart under #chart-container2 element using chart group A
var chart2 = dc.barChart("#chart-container2", "chartGroupA");
// create a sub-chart under a composite parent chart
var chart3 = dc.barChart(compositeChart);
```

**/
dc.barChart = function (parent, chartGroup) {
    var MIN_BAR_WIDTH = 1;
    var DEFAULT_GAP_BETWEEN_BARS = 2;

    var _chart = dc.stackableChart(dc.coordinateGridChart({}));

    var _gap = DEFAULT_GAP_BETWEEN_BARS;
    var _centerBar = false;

    var _barWidth;

    dc.override(_chart, 'rescale', function () {
        _chart._rescale();
        _barWidth = undefined;
    });

    _chart.plotData = function () {
        var layers = _chart.chartBodyG().selectAll("g.stack")
            .data(_chart.stackLayers());

        calculateBarWidth();

        layers
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return "stack " + "_" + i;
            });

        layers.each(function (d) {
            var layer = d3.select(this);

            renderBars(layer, d);
        });

        _chart.stackLayers(null);
    };

    function barHeight(d) {
        return dc.utils.safeNumber(Math.abs(_chart.y()(d.y + d.y0) - _chart.y()(d.y0)));
    }

    function renderBars(layer, d) {
        var bars = layer.selectAll("rect.bar")
            .data(d.points, dc.pluck('data', _chart.keyAccessor()));

        bars.enter()
            .append("rect")
            .attr("class", "bar")
            .attr("fill", _chart.getColor);

        if (_chart.renderTitle()) {
            bars.append("title").text(dc.pluck('data',_chart.title()));
        }

        if (_chart.isOrdinal())
            bars.on("click", onClick);

        dc.transition(bars, _chart.transitionDuration())
            .attr("x", function (d) {
                var x = _chart.x()(d.x);
                if (_centerBar) x -= _barWidth / 2;
                if (_chart.isOrdinal()) x += _gap/2;
                return  dc.utils.safeNumber(x);
            })
            .attr("y", function (d) {
                var y = _chart.y()(d.y + d.y0);

                if (d.y < 0)
                    y -= barHeight(d);

                return dc.utils.safeNumber(y);
            })
            .attr("width", _barWidth)
            .attr("height", function (d) {
                return barHeight(d);
            })
            .select("title").text(dc.pluck('data',_chart.title()));

        dc.transition(bars.exit(), _chart.transitionDuration())
            .attr("height", 0)
            .remove();
    }

    function calculateBarWidth() {
        if (_barWidth === undefined) {
            var numberOfBars = _chart.xUnitCount();

            if (_chart.isOrdinal() && !_gap)
                _barWidth = Math.floor(_chart.x().rangeBand());
            else if (_gap)
                _barWidth = Math.floor((_chart.xAxisLength() - (numberOfBars - 1) * _gap) / numberOfBars);
            else
                _barWidth = Math.floor(_chart.xAxisLength() / (1 + _chart.barPadding()) / numberOfBars);

            if (_barWidth == Infinity || isNaN(_barWidth) || _barWidth < MIN_BAR_WIDTH)
                _barWidth = MIN_BAR_WIDTH;
        }
    }

    _chart.fadeDeselectedArea = function () {
        var bars = _chart.chartBodyG().selectAll("rect.bar");
        var extent = _chart.brush().extent();

        if (_chart.isOrdinal()) {
            if (_chart.hasFilter()) {
                bars.classed(dc.constants.SELECTED_CLASS, function (d) {
                    return _chart.hasFilter(_chart.keyAccessor()(d.data));
                });
                bars.classed(dc.constants.DESELECTED_CLASS, function (d) {
                    return !_chart.hasFilter(_chart.keyAccessor()(d.data));
                });
            } else {
                bars.classed(dc.constants.SELECTED_CLASS, false);
                bars.classed(dc.constants.DESELECTED_CLASS, false);
            }
        } else {
            if (!_chart.brushIsEmpty(extent)) {
                var start = extent[0];
                var end = extent[1];

                bars.classed(dc.constants.DESELECTED_CLASS, function (d) {
                    var xValue = _chart.keyAccessor()(d.data);
                    return xValue < start || xValue >= end;
                });
            } else {
                bars.classed(dc.constants.DESELECTED_CLASS, false);
            }
        }
    };

    /**
    #### .centerBar(boolean)
    Whether the bar chart will render each bar centered around the data position on x axis. Default to false.

    **/
    _chart.centerBar = function (_) {
        if (!arguments.length) return _centerBar;
        _centerBar = _;
        return _chart;
    };

    function onClick(d) {
        _chart.onClick(d.data);
    }

    /**
    ### .barPadding([padding])
    Get or set the spacing between bars as a fraction of bar size. Valid values are within 0-1.
    Setting this value will also remove any previously set `gap`. See the
    [d3 docs](https://github.com/mbostock/d3/wiki/Ordinal-Scales#wiki-ordinal_rangeBands)
    for a visual description of how the padding is applied.
    **/
    _chart.barPadding = function (_) {
        if (!arguments.length) return _chart._rangeBandPadding();
        _chart._rangeBandPadding(_);
        _gap = 0;
        return _chart;
    };

    /**
    ### .outerPadding([padding])
    Get or set the outer padding on an ordinal bar chart. This setting has no effect on non-ordinal charts.
    Padding equivlent in width to `padding * barWidth` will be added on each side of the chart.

    Default: 0.5
    **/
    _chart.outerPadding = _chart._outerRangeBandPadding;

    /**
    #### .gap(gapBetweenBars)
    Manually set fixed gap (in px) between bars instead of relying on the default auto-generated gap. By default bar chart
    implementation will calculate and set the gap automatically based on the number of data points and the length of the x axis.

    **/
    _chart.gap = function (_) {
        if (!arguments.length) return _gap;
        _gap = _;
        return _chart;
    };

    _chart.extendBrush = function () {
        var extent = _chart.brush().extent();
        if (_chart.round() && !_centerBar) {
            extent[0] = extent.map(_chart.round())[0];
            extent[1] = extent.map(_chart.round())[1];

            _chart.chartBodyG().select(".brush")
                .call(_chart.brush().extent(extent));
        }
        return extent;
    };

    _chart.legendHighlight = function (d) {
        _chart.select('.chart-body').selectAll('rect.bar').filter(function () {
            return d3.select(this).attr('fill') == d.color;
        }).classed('highlight', true);
        _chart.select('.chart-body').selectAll('rect.bar').filter(function () {
            return d3.select(this).attr('fill') != d.color;
        }).classed('fadeout', true);
    };

    _chart.legendReset = function (d) {
        _chart.selectAll('.chart-body').selectAll('rect.bar').filter(function () {
            return d3.select(this).attr('fill') == d.color;
        }).classed('highlight', false);
        _chart.selectAll('.chart-body').selectAll('rect.bar').filter(function () {
            return d3.select(this).attr('fill') != d.color;
        }).classed('fadeout', false);
    };

    dc.override(_chart, "xAxisMax", function() {
        var max = this._xAxisMax();
        if('resolution' in _chart.xUnits()) {
            var res = _chart.xUnits().resolution;
            max += res;
        }
        return max;
    });

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="line-chart" href="#line-chart">#</a> Line Chart [Concrete] < [Stackable Chart](#stackable-chart) < [CoordinateGrid Chart](#coordinate-grid-chart)
Concrete line/area chart implementation.

Examples:
* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)
* [Canadian City Crime Stats](http://nickqizhu.github.com/dc.js/crime/index.html)

#### dc.lineChart(parent[, chartGroup])
Create a line chart instance and attach it to the given parent element.

Parameters:

* parent : string|compositeChart - any valid d3 single selector representing typically a dom block element such
   as a div, or if this line chart is a sub-chart in a [Composite Chart](#composite-chart) then pass in the parent composite chart instance.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created line chart instance

```js
// create a line chart under #chart-container1 element using the default global chart group
var chart1 = dc.lineChart("#chart-container1");
// create a line chart under #chart-container2 element using chart group A
var chart2 = dc.lineChart("#chart-container2", "chartGroupA");
// create a sub-chart under a composite parent chart
var chart3 = dc.lineChart(compositeChart);
```

**/
dc.lineChart = function (parent, chartGroup) {
    var DEFAULT_DOT_RADIUS = 5;
    var TOOLTIP_G_CLASS = "dc-tooltip";
    var DOT_CIRCLE_CLASS = "dot";
    var Y_AXIS_REF_LINE_CLASS = "yRef";
    var X_AXIS_REF_LINE_CLASS = "xRef";
    var DEFAULT_DOT_OPACITY = 1e-6;

    var _chart = dc.stackableChart(dc.coordinateGridChart({}));
    var _renderArea = false;
    var _dotRadius = DEFAULT_DOT_RADIUS;
    var _dataPointRadius = null;
    var _dataPointFillOpacity = DEFAULT_DOT_OPACITY;
    var _dataPointStrokeOpacity = DEFAULT_DOT_OPACITY;
    var _interpolate = 'linear';
    var _tension = 0.7;
    var _defined;
    var _dashStyle;

    _chart.transitionDuration(500);

    _chart.plotData = function () {
        var chartBody = _chart.chartBodyG();
        var layersList = chartBody.selectAll("g.stack-list");

        if (layersList.empty()) layersList = chartBody.append("g").attr("class", "stack-list");

        var layers = layersList.selectAll("g.stack").data(_chart.stackLayers());

        var layersEnter = layers
            .enter()
            .append("g")
            .attr("class", function (d, i) {
                return "stack " + "_" + i;
            });

        drawLine(layersEnter, layers);

        drawArea(layersEnter, layers);

        drawDots(chartBody, layers);

        _chart.stackLayers(null);
    };

    _chart.interpolate = function(_){
        if (!arguments.length) return _interpolate;
        _interpolate = _;
        return _chart;
    };

    _chart.tension = function(_){
        if (!arguments.length) return _tension;
        _tension = _;
        return _chart;
    };

    _chart.defined = function(_){
        if (!arguments.length) return _defined;
        _defined = _;
        return _chart;
    };
    /**
    #### .dashStyle([array])
    Set the line's d3 dashstyle. This value becomes "stroke-dasharray" of line. Defaults to empty array (solid line).
     ```js
     // create a Dash Dot Dot Dot
     chart.dashStyle([3,1,1,1]);
     ```
    **/
    _chart.dashStyle = function (_) {
        if (!arguments.length) return _dashStyle;
        _dashStyle = _;
        return _chart;
    };

    /**
    #### .renderArea([boolean])
    Get or set render area flag. If the flag is set to true then the chart will render the area beneath each line and effectively
    becomes an area chart.

    **/
    _chart.renderArea = function (_) {
        if (!arguments.length) return _renderArea;
        _renderArea = _;
        return _chart;
    };

    function drawLine(layersEnter, layers) {
        var line = d3.svg.line()
            .x(function (d) {
                return _chart.x()(d.x);
            })
            .y(function (d) {
                return _chart.y()(d.y + d.y0);
            })
            .interpolate(_interpolate)
            .tension(_tension);
        if (_defined)
            line.defined(_defined);


        var path = layersEnter.append("path")
            .attr("class", "line")
            .attr("stroke", _chart.getColor)
            .attr("fill", _chart.getColor);
        if (_dashStyle)
            path.attr("stroke-dasharray", _dashStyle);

        dc.transition(layers.select("path.line"), _chart.transitionDuration())
            .attr("d", function (d) {
                return safeD(line(d.points));
            });
    }

    function drawArea(layersEnter, layers) {
        if (_renderArea) {
            var area = d3.svg.area()
                .x(function (d) {
                    return _chart.x()(d.x);
                })
                .y(function (d) {
                    return _chart.y()(d.y + d.y0);
                })
                .y0(function (d) {
                    return _chart.y()(d.y0);
                })
                .interpolate(_interpolate)
                .tension(_tension);
            if (_defined)
                area.defined(_defined);


            layersEnter.append("path")
                .attr("class", "area")
                .attr("fill", _chart.getColor)
                .attr("d", function (d) {
                    return safeD(area(d.points));
                });

            dc.transition(layers.select("path.area"), _chart.transitionDuration())
                .attr("d", function (d) {
                    return safeD(area(d.points));
                });
        }
    }

    function safeD(d){
        return (!d || d.indexOf("NaN") >= 0) ? "M0,0" : d;
    }

    function drawDots(chartBody, layers) {
        if (!_chart.brushOn()) {

            var tooltipListClass = TOOLTIP_G_CLASS + "-list";
            var tooltips = chartBody.select("g." + tooltipListClass);

            if (tooltips.empty()) tooltips = chartBody.append("g").attr("class", tooltipListClass);

            layers.each(function (d, layerIndex) {
                var layer = d3.select(this);
                var points = layer.datum().points;
                if (_defined) points = points.filter(_defined);

                var g = tooltips.select("g." + TOOLTIP_G_CLASS + "._" + layerIndex);
                if (g.empty()) g = tooltips.append("g").attr("class", TOOLTIP_G_CLASS + " _" + layerIndex);

                createRefLines(g);

                var dots = g.selectAll("circle." + DOT_CIRCLE_CLASS).data(points);

                dots.enter()
                    .append("circle")
                    .attr("class", DOT_CIRCLE_CLASS)
                    .attr("r", _dataPointRadius || _dotRadius)
                    .attr("fill", _chart.getColor)
                    .style("fill-opacity", _dataPointFillOpacity)
                    .style("stroke-opacity", _dataPointStrokeOpacity)
                    .on("mousemove", function (d) {
                        var dot = d3.select(this);
                        showDot(dot);
                        showRefLines(dot, g);
                    })
                    .on("mouseout", function (d) {
                        var dot = d3.select(this);
                        hideDot(dot);
                        hideRefLines(g);
                    })
                    .append("title").text(dc.pluck('data', _chart.getTitleByIndex(layerIndex)));

                dots.attr("cx", function (d) {
                        return dc.utils.safeNumber(_chart.x()(d.x));
                    })
                    .attr("cy", function (d) {
                        return dc.utils.safeNumber(_chart.y()(d.y + d.y0));
                    })
                    .select("title").text(dc.pluck('data', _chart.getTitleByIndex(layerIndex)));

                dots.exit().remove();
            });
        }
    }

    function createRefLines(g) {
        var yRefLine = g.select("path." + Y_AXIS_REF_LINE_CLASS).empty() ? g.append("path").attr("class", Y_AXIS_REF_LINE_CLASS) : g.select("path." + Y_AXIS_REF_LINE_CLASS);
        yRefLine.style("display", "none").attr("stroke-dasharray", "5,5");

        var xRefLine = g.select("path." + X_AXIS_REF_LINE_CLASS).empty() ? g.append("path").attr("class", X_AXIS_REF_LINE_CLASS) : g.select("path." + X_AXIS_REF_LINE_CLASS);
        xRefLine.style("display", "none").attr("stroke-dasharray", "5,5");
    }

    function showDot(dot) {
        dot.style("fill-opacity", 0.8);
        dot.style("stroke-opacity", 0.8);
        dot.attr("r", _dotRadius);
        return dot;
    }

    function showRefLines(dot, g) {
        var x = dot.attr("cx");
        var y = dot.attr("cy");
        g.select("path." + Y_AXIS_REF_LINE_CLASS).style("display", "").attr("d", "M0 " + y + "L" + (x) + " " + (y));
        g.select("path." + X_AXIS_REF_LINE_CLASS).style("display", "").attr("d", "M" + x + " " + _chart.yAxisHeight() + "L" + x + " " + y);
    }

    function hideDot(dot) {
        dot.style("fill-opacity", _dataPointFillOpacity)
            .style("stroke-opacity", _dataPointStrokeOpacity)
            .attr("r", _dataPointRadius);
    }

    function hideRefLines(g) {
        g.select("path." + Y_AXIS_REF_LINE_CLASS).style("display", "none");
        g.select("path." + X_AXIS_REF_LINE_CLASS).style("display", "none");
    }

    /**
    #### .dotRadius([dotRadius])
    Get or set the radius (in px) for data points. Default dot radius is 5.
    **/
    _chart.dotRadius = function (_) {
        if (!arguments.length) return _dotRadius;
        _dotRadius = _;
        return _chart;
    };

    /**
    #### .renderDataPoints([options])
    Always show individual dots for each datapoint.

    Options, if given, is an object that can contain the following:

    * fillOpacity (default 0.8)
    * strokeOpacity (default 0.8)
    * radius (default 2)

    If `options` is falsy, it disable data point rendering.

    If no `options` are provded, the current `options` values are instead returned

    Example:
    ```
    chart.renderDataPoints([{radius: 2, fillOpacity: 0.8, strokeOpacity: 0.8}])
    ```
    **/
    _chart.renderDataPoints = function (options) {
        if (!arguments.length) {
            return {
                fillOpacity: _dataPointFillOpacity,
                strokeOpacity: _dataPointStrokeOpacity,
                radius: _dataPointRadius
            };
        } else if (!options) {
            _dataPointFillOpacity = DEFAULT_DOT_OPACITY;
            _dataPointStrokeOpacity = DEFAULT_DOT_OPACITY;
            _dataPointRadius = null;
        } else {
            _dataPointFillOpacity = options.fillOpacity || 0.8;
            _dataPointStrokeOpacity = options.strokeOpacity || 0.8;
            _dataPointRadius = options.radius || 2;
        }
        return _chart;
    };

    _chart.legendHighlight = function (d) {
        _chart.selectAll('.chart-body').selectAll('path').filter(function () {
            return d3.select(this).attr('fill') == d.color;
        }).classed('highlight', true);
        _chart.selectAll('.chart-body').selectAll('path').filter(function () {
            return d3.select(this).attr('fill') != d.color;
        }).classed('fadeout', true);
    };

    _chart.legendReset = function (d) {
        _chart.selectAll('.chart-body').selectAll('path').filter(function () {
            return d3.select(this).attr('fill') == d.color;
        }).classed('highlight', false);
        _chart.selectAll('.chart-body').selectAll('path').filter(function () {
            return d3.select(this).attr('fill') != d.color;
        }).classed('fadeout', false);
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="data-count" href="#data-count">#</a> Data Count Widget [Concrete] < [Base Chart](#base-chart)
Data count is a simple widget designed to display total number records in the data set vs. the number records selected
by the current filters. Once created data count widget will automatically update the text content of the following elements
under the parent element.

* ".total-count" - total number of records
* ".filter-count" - number of records matched by the current filters

Examples:

* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)

#### dc.dataCount(parent[, chartGroup])
Create a data count widget instance and attach it to the given parent element.

Parameters:

* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created data count widget instance

#### .dimension(allData) - **mandatory**
For data count widget the only valid dimension is the entire data set.

#### .group(groupAll) - **mandatory**
For data count widget the only valid group is the all group.

```js
var ndx = crossfilter(data);
var all = ndx.groupAll();

dc.dataCount(".dc-data-count")
    .dimension(ndx)
    .group(all);
```

**/
dc.dataCount = function(parent, chartGroup) {
    var _formatNumber = d3.format(",d");
    var _chart = dc.baseChart({});

    _chart.doRender = function() {
        _chart.selectAll(".total-count").text(_formatNumber(_chart.dimension().size()));
        _chart.selectAll(".filter-count").text(_formatNumber(_chart.group().value()));

        return _chart;
    };

    _chart.doRedraw = function(){
        return _chart.doRender();
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="data-table" href="#data-table">#</a> Data Table Widget [Concrete] < [Base Chart](#base-chart)
Data table is a simple widget designed to list crossfilter focused data set (rows being filtered) in a good old tabular
fashion.

Examples:
* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)

#### dc.dataTable(parent[, chartGroup])
Create a data table widget instance and attach it to the given parent element.

Parameters:
* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created data table widget instance

**/
dc.dataTable = function(parent, chartGroup) {
    var LABEL_CSS_CLASS = "dc-table-label";
    var ROW_CSS_CLASS = "dc-table-row";
    var COLUMN_CSS_CLASS = "dc-table-column";
    var GROUP_CSS_CLASS = "dc-table-group";

    var _chart = dc.baseChart({});

    var _size = 25;
    var _columns = [];
    var _sortBy = function(d) {
        return d;
    };
    var _order = d3.ascending;
    var _sort;

    _chart.doRender = function() {
        _chart.selectAll("tbody").remove();

        renderRows(renderGroups());

        return _chart;
    };

    function renderGroups() {
        var groups = _chart.root().selectAll("tbody")
            .data(nestEntries(), function(d) {
                return _chart.keyAccessor()(d);
            });

        var rowGroup = groups
            .enter()
            .append("tbody");

        rowGroup
            .append("tr")
            .attr("class", GROUP_CSS_CLASS)
                .append("td")
                .attr("class", LABEL_CSS_CLASS)
                .attr("colspan", _columns.length)
                .html(function(d) {
                    return _chart.keyAccessor()(d);
                });

        groups.exit().remove();

        return rowGroup;
    }

    function nestEntries() {
        if (!_sort)
            _sort = crossfilter.quicksort.by(_sortBy);

        var entries = _chart.dimension().top(_size);

        return d3.nest()
            .key(_chart.group())
            .sortKeys(_order)
            .sortValues(_order)
            .entries(_sort(entries, 0, entries.length));
    }

    function renderRows(groups) {
        var rows = groups.order()
            .selectAll("tr." + ROW_CSS_CLASS)
            .data(function(d) {
                return d.values;
            });

        var rowEnter = rows.enter()
            .append("tr")
            .attr("class", ROW_CSS_CLASS);

        _columns.forEach(function(f,i) {
            rowEnter.append("td")
                .attr("class", COLUMN_CSS_CLASS + " _" + i)
                .html(f);
        });

        rows.exit().remove();

        return rows;
    }

    _chart.doRedraw = function() {
        return _chart.doRender();
    };

    /**
    #### .size([size])
    Get or set the table size which determines the number of rows displayed by the widget.

    **/
    _chart.size = function(s) {
        if (!arguments.length) return _size;
        _size = s;
        return _chart;
    };

    /**
    #### .columns([columnFunctionArray])
    Get or set column functions. Data table widget uses an array of functions to generate dynamic columns. Column functions are
    simple javascript function with only one input argument d which represents a row in the data set, and the return value of
    these functions will be used directly to generate table content for each cell.

    ```js
        chart.columns([
            function(d) {
                return d.date;
            },
            function(d) {
                return d.open;
            },
            function(d) {
                return d.close;
            },
            function(d) {
                return numberFormat(d.close - d.open);
            },
            function(d) {
                return d.volume;
            }
        ]);
    ```

    **/
    _chart.columns = function(_) {
        if (!arguments.length) return _columns;
        _columns = _;
        return _chart;
    };

    /**
    #### .sortBy([sortByFunction])
    Get or set sort-by function. This function works as a value accessor at row level and returns a particular field to be sorted
    by. Default value: ``` function(d) {return d;}; ```

    ```js
       chart.sortBy(function(d) {
            return d.date;
        });
    ```

    **/
    _chart.sortBy = function(_) {
        if (!arguments.length) return _sortBy;
        _sortBy = _;
        return _chart;
    };

    /**
    #### .order([order])
    Get or set sort order. Default value: ``` d3.ascending ```

    ```js
        chart.order(d3.descending);
    ```

    **/
    _chart.order = function(_) {
        if (!arguments.length) return _order;
        _order = _;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="bubble-chart" href="#bubble-chart">#</a> Bubble Chart [Concrete] < [Abstract Bubble Chart](#abstract-bubble-chart) < [CoordinateGrid Chart](#coordinate-grid-chart)
A concrete implementation of a general purpose bubble chart that allows data visualization using the following dimensions:

* x axis position
* y axis position
* bubble radius
* color

Examples:
* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)
* [US Venture Capital Landscape 2011](http://nickqizhu.github.com/dc.js/vc/index.html)

#### dc.bubbleChart(parent[, chartGroup])
Create a bubble chart instance and attach it to the given parent element.

Parameters:
* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created bubble chart instance

```js
// create a bubble chart under #chart-container1 element using the default global chart group
var bubbleChart1 = dc.bubbleChart("#chart-container1");
// create a bubble chart under #chart-container2 element using chart group A
var bubbleChart2 = dc.bubbleChart("#chart-container2", "chartGroupA");
```

**/
dc.bubbleChart = function(parent, chartGroup) {
    var _chart = dc.abstractBubbleChart(dc.coordinateGridChart({}));

    var _elasticRadius = false;

    _chart.transitionDuration(750);

    var bubbleLocator = function(d) {
        return "translate(" + (bubbleX(d)) + "," + (bubbleY(d)) + ")";
    };

    /**
    #### .elasticRadius([boolean])
    Turn on or off elastic bubble radius feature. If this feature is turned on, then bubble radiuses will be automatically rescaled
    to fit the chart better.

    **/
    _chart.elasticRadius = function(_) {
        if (!arguments.length) return _elasticRadius;
        _elasticRadius = _;
        return _chart;
    };

    _chart.plotData = function() {
        if (_elasticRadius)
            _chart.r().domain([_chart.rMin(), _chart.rMax()]);

        _chart.r().range([_chart.MIN_RADIUS, _chart.xAxisLength() * _chart.maxBubbleRelativeSize()]);

        var bubbleG = _chart.chartBodyG().selectAll("g." + _chart.BUBBLE_NODE_CLASS)
            .data(_chart.data(),_chart.keyAccessor());

        renderNodes(bubbleG);

        updateNodes(bubbleG);

        removeNodes(bubbleG);

        _chart.fadeDeselectedArea();
    };

    function renderNodes(bubbleG) {
        var bubbleGEnter = bubbleG.enter().append("g");

        bubbleGEnter
            .attr("class", _chart.BUBBLE_NODE_CLASS)
            .attr("transform", bubbleLocator)
            .append("circle").attr("class", function(d, i) {
                return _chart.BUBBLE_CLASS + " _" + i;
            })
            .on("click", _chart.onClick)
            .attr("fill", _chart.getColor)
            .attr("r", 0);
        dc.transition(bubbleG, _chart.transitionDuration())
            .attr("r", function(d) {
                return _chart.bubbleR(d);
            })
            .attr("opacity", function(d) {
                return (_chart.bubbleR(d) > 0) ? 1 : 0;
            });

        _chart.doRenderLabel(bubbleGEnter);

        _chart.doRenderTitles(bubbleGEnter);
    }

    function updateNodes(bubbleG) {
        dc.transition(bubbleG, _chart.transitionDuration())
            .attr("transform", bubbleLocator)
            .selectAll("circle." + _chart.BUBBLE_CLASS)
            .attr("fill", _chart.getColor)
            .attr("r", function(d) {
                return _chart.bubbleR(d);
            })
            .attr("opacity", function(d) {
                return (_chart.bubbleR(d) > 0) ? 1 : 0;
            });

        _chart.doUpdateLabels(bubbleG);
        _chart.doUpdateTitles(bubbleG);
    }

    function removeNodes(bubbleG) {
        bubbleG.exit().remove();
    }

    function bubbleX(d) {
        var x = _chart.x()(_chart.keyAccessor()(d));
        if (isNaN(x))
            x = 0;
        return x;
    }

    function bubbleY(d) {
        var y = _chart.y()(_chart.valueAccessor()(d));
        if (isNaN(y))
            y = 0;
        return y;
    }

    _chart.renderBrush = function(g) {
        // override default x axis brush from parent chart
    };

    _chart.redrawBrush = function(g) {
        // override default x axis brush from parent chart
        _chart.fadeDeselectedArea();
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="composite-chart" href="#composite-chart">#</a> Composite Chart [Concrete] < [CoordinateGrid Chart](#coordinate-grid-chart)
Composite chart is a special kind of chart that resides somewhere between abstract and concrete charts. It does not
generate data visualization directly, but rather working with other concrete charts to do the job. You can essentially
overlay(compose) different bar/line/area charts in a single composite chart to achieve some quite flexible charting
effects.

Examples:
* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)

#### dc.compositeChart(parent[, chartGroup])
Create a composite chart instance and attach it to the given parent element.

Parameters:
* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created composite chart instance

```js
// create a composite chart under #chart-container1 element using the default global chart group
var compositeChart1 = dc.compositeChart("#chart-container1");
// create a composite chart under #chart-container2 element using chart group A
var compositeChart2 = dc.compositeChart("#chart-container2", "chartGroupA");
```

**/
dc.compositeChart = function (parent, chartGroup) {
    var SUB_CHART_CLASS = "sub";

    var _chart = dc.coordinateGridChart({});
    var _children = [];

    var _shareColors = false,
        _shareTitle = true;

    _chart._mandatoryAttributes([]);
    _chart.transitionDuration(500);

    dc.override(_chart, "_generateG", function () {
        var g = this.__generateG();

        for (var i = 0; i < _children.length; ++i) {
            var child = _children[i];

            generateChildG(child, i);

            if (!child.dimension()) child.dimension(_chart.dimension());
            if (!child.group()) child.group(_chart.group());
            child.chartGroup(_chart.chartGroup());
            child.svg(_chart.svg());
            child.xUnits(_chart.xUnits());
            child.transitionDuration(_chart.transitionDuration());
            child.brushOn(_chart.brushOn());
        }

        return g;
    });

    function generateChildG(child, i) {
        child._generateG(_chart.g());
        child.g().attr("class", SUB_CHART_CLASS + " _" + i);
    }

    _chart.plotData = function () {
        for (var i = 0; i < _children.length; ++i) {
            var child = _children[i];

            if (!child.g()) {
                generateChildG(child, i);
            }

            if (_shareColors)
                child.colors(_chart.colors());

            child.x(_chart.x());
            child.y(_chart.y());
            child.xAxis(_chart.xAxis());
            child.yAxis(_chart.yAxis());

            child.plotData();

            child.activateRenderlets();
        }
    };

    _chart.fadeDeselectedArea = function () {
        for (var i = 0; i < _children.length; ++i) {
            var child = _children[i];
            child.brush(_chart.brush());
            child.fadeDeselectedArea();
        }
    };

    /**
    #### .compose(subChartArray)
    Combine the given charts into one single composite coordinate grid chart.

    ```js
    // compose the given charts in the array into one single composite chart
    moveChart.compose([
        // when creating sub-chart you need to pass in the parent chart
        dc.lineChart(moveChart)
            .group(indexAvgByMonthGroup) // if group is missing then parent's group will be used
            .valueAccessor(function(d){return d.value.avg;})
            // most of the normal functions will continue to work in a composed chart
            .renderArea(true)
            .stack(monthlyMoveGroup, function(d){return d.value;})
            .title(function(d){
                var value = d.value.avg?d.value.avg:d.value;
                if(isNaN(value)) value = 0;
                return dateFormat(d.key) + "\n" + numberFormat(value);
            }),
        dc.barChart(moveChart)
            .group(volumeByMonthGroup)
            .centerBar(true)
    ]);
    ```

    **/
    _chart.compose = function (charts) {
        _children = charts;
        _children.forEach(function(child, i) {
            child.height(_chart.height());
            child.width(_chart.width());
            child.margins(_chart.margins());

            if (_shareTitle) {
                child.title(_chart.title());
            }

            if (_shareColors && child.colorAccessor() === child._layerColorAccessor)
                child.colorCalculator(function() {return child.colors()(i);});

        });
        return _chart;
    };

    _chart.children = function () {
        return _children;
    };

    /**
    #### .shareColors([boolean])
    Get or set color sharing for the chart. If set, the `.colors()` value from this chart
    will be shared with composed children. Additionally if the child chart implements
    Stackable and has not set a custom .colorAccessor, then it will generate a color
    specific to its order in the composition.
    **/
    _chart.shareColors = function (_) {
        if (!arguments.length) return _shareColors;
        _shareColors = _;
        return _chart;
    };

    /**
     #### .shareTitle([[boolean])
     Get or set title sharing for the chart. If set, the `.title()` value from this chart
     will be shared with composed children. Default value is true.
     **/
    _chart.shareTitle = function (_) {
        if (!arguments.length) return _shareTitle;
        _shareTitle = _;
        return _chart;
    };

    function getAllYAxisMinFromChildCharts() {
        var allMins = [];
        for (var i = 0; i < _children.length; ++i) {
            allMins.push(_children[i].yAxisMin());
        }
        return allMins;
    }

    _chart.yAxisMin = function () {
        return d3.min(getAllYAxisMinFromChildCharts());
    };

    function getAllYAxisMaxFromChildCharts() {
        var allMaxes = [];
        for (var i = 0; i < _children.length; ++i) {
            allMaxes.push(_children[i].yAxisMax());
        }
        return allMaxes;
    }

    _chart.yAxisMax = function () {
        return dc.utils.add(d3.max(getAllYAxisMaxFromChildCharts()), _chart.yAxisPadding());
    };

    function getAllXAxisMinFromChildCharts() {
        var allMins = [];
        for (var i = 0; i < _children.length; ++i) {
            allMins.push(_children[i].xAxisMin());
        }
        return allMins;
    }

    _chart.xAxisMin = function () {
        return dc.utils.subtract(d3.min(getAllXAxisMinFromChildCharts()), _chart.xAxisPadding());
    };

    function getAllXAxisMaxFromChildCharts() {
        var allMaxes = [];
        for (var i = 0; i < _children.length; ++i) {
            allMaxes.push(_children[i].xAxisMax());
        }
        return allMaxes;
    }

    _chart.xAxisMax = function () {
        return dc.utils.add(d3.max(getAllXAxisMaxFromChildCharts()), _chart.xAxisPadding());
    };

    _chart.legendables = function () {
        var items = [];
        _children.forEach(function(child, i) {
            if (_shareColors)
                child.colors(_chart.colors());

            var childLegendables = child.legendables();
            if (childLegendables.length)
                items.push.apply(items,childLegendables);
            else
                items.push(dc.utils.createLegendable(child, child.group(), child.valueAccessor(), child.colorCalculator()(i)));
        });
        return items;
    };

    _chart.legendHighlight = function (d) {
        for (var j = 0; j < _children.length; ++j) {
            var child = _children[j];
            child.legendHighlight(d);
        }
    };

    _chart.legendReset = function (d) {
        for (var j = 0; j < _children.length; ++j) {
            var child = _children[j];
            child.legendReset(d);
        }
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="series-chart" href="#Series-chart">#</a> Series Chart [Concrete] < [Color Chart](#color-chart) < [Base Chart](#base-chart)
 A series chart is a chart that shows multiple series of data as lines, where the series
 is specified in the data.

 #### dc.seriesChart(parent[, chartGroup])
 Create a series chart instance and attach it to the given parent element.

 Parameters:
 * parent : string - any valid d3 single selector representing typically a dom block element such as a div.
 * chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
 in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
 chart group.

 Return:
 A newly created series chart instance

 ```js
 // create a series chart under #chart-container1 element using the default global chart group
 var seriesChart1 = dc.seriesChart("#chart-container1");
 // create a series chart under #chart-container2 element using chart group A
 var seriesChart2 = dc.seriesChart("#chart-container2", "chartGroupA");
 ```

 **/
dc.seriesChart = function (parent, chartGroup) {
    var _chart = dc.compositeChart(parent, chartGroup);

    var _charts = {};
    var _chartFunction = dc.lineChart;
    var _seriesAccessor;
    var _seriesSort = d3.ascending;
    var _valueSort = keySort;

    _chart._mandatoryAttributes().push('seriesAccessor','chart');
    _chart.shareColors(true);

    function keySort(a,b) {
        return d3.ascending(_chart.keyAccessor()(a), _chart.keyAccessor()(b));
    }

    _chart._preprocessData = function () {
        var keep = [];
        var children_changed;
        var nester = d3.nest().key(_seriesAccessor);
        if(_seriesSort)
            nester.sortKeys(_seriesSort);
        if(_valueSort)
            nester.sortValues(_valueSort);
        var nesting = nester.entries(_chart.data());
        var children =
            nesting.map(function(sub,i) {
                var subChart = _charts[sub.key] || _chartFunction.call(_chart,_chart,chartGroup,sub.key,i);
                if(!_charts[sub.key])
                    children_changed = true;
                _charts[sub.key] = subChart;
                keep.push(sub.key);
                return subChart
                    .dimension(_chart.dimension())
                    .group({all:d3.functor(sub.values)}, sub.key)
                    .keyAccessor(_chart.keyAccessor())
                    .valueAccessor(_chart.valueAccessor())
                    .colorCalculator(function() {return subChart.colors()(sub.key);});
            });
        // this works around the fact compositeChart doesn't really
        // have a removal interface
        Object.keys(_charts)
            .filter(function(c) {return keep.indexOf(c) === -1;})
            .forEach(function(c) {
                clearChart(c);
                children_changed = true;
            });
        _chart._compose(children);
        if(children_changed && _chart.legend())
            _chart.legend().render();
    };

    function clearChart(c) {
        if(_charts[c].g())
            _charts[c].g().remove();
        delete _charts[c];
    }

    function resetChildren() {
        Object.keys(_charts).map(clearChart);
        _charts = {};
    }

    _chart.chart = function(_) {
        if (!arguments.length) return _chartFunction;
        _chartFunction = _;
        resetChildren();
        return _chart;
    };

    /**
     #### .seriesAccessor([accessor])
     Get or set accessor function for the displayed series. Given a datum, this function
     should return the series that datum belongs to.
     **/
    _chart.seriesAccessor = function(_) {
        if (!arguments.length) return _seriesAccessor;
        _seriesAccessor = _;
        resetChildren();
        return _chart;
    };

    /**
     #### .seriesSort([sortFunction])
     Get or set a function to sort the list of series by, given series values.

     Example:
     ```
     chart.seriesSort(d3.descending);
     ```
     **/
    _chart.seriesSort = function(_) {
        if (!arguments.length) return _seriesSort;
        _seriesSort = _;
        resetChildren();
        return _chart;
    };

    _chart.valueSort = function(_) {
        if (!arguments.length) return _valueSort;
        _valueSort = _;
        resetChildren();
        return _chart;
    };

    // make compose private
    _chart._compose = _chart.compose;
    delete _chart.compose;

    return _chart;
};

/**
## <a name="geo-choropleth-chart" href="#geo-choropleth-chart">#</a> Geo Choropleth Chart [Concrete] < [Color Chart](#color-chart) < [Base Chart](#base-chart)
Geo choropleth chart is design to make creating crossfilter driven choropleth map from GeoJson data an easy process. This
chart implementation was inspired by [the great d3 choropleth example](http://bl.ocks.org/4060606).

Examples:
* [US Venture Capital Landscape 2011](http://nickqizhu.github.com/dc.js/vc/index.html)

#### dc.geoChoroplethChart(parent[, chartGroup])
Create a choropleth chart instance and attach it to the given parent element.

Parameters:
* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created choropleth chart instance

```js
// create a choropleth chart under "#us-chart" element using the default global chart group
var chart1 = dc.geoChoroplethChart("#us-chart");
// create a choropleth chart under "#us-chart2" element using chart group A
var chart2 = dc.compositeChart("#us-chart2", "chartGroupA");
```

**/
dc.geoChoroplethChart = function (parent, chartGroup) {
    var _chart = dc.colorChart(dc.baseChart({}));

    _chart.colorAccessor(function (d, i) {
        return d || 0;
    });

    var _geoPath = d3.geo.path();
    var _projectionFlag;

    var _geoJsons = [];

    _chart.doRender = function () {
        _chart.resetSvg();
        for (var layerIndex = 0; layerIndex < _geoJsons.length; ++layerIndex) {
            var states = _chart.svg().append("g")
                .attr("class", "layer" + layerIndex);

            var regionG = states.selectAll("g." + geoJson(layerIndex).name)
                .data(geoJson(layerIndex).data)
                .enter()
                .append("g")
                .attr("class", geoJson(layerIndex).name);

            regionG
                .append("path")
                .attr("fill", "white")
                .attr("d", _geoPath);

            regionG.append("title");

            plotData(layerIndex);
        }
        _projectionFlag = false;
    };

    function plotData(layerIndex) {
        var data = generateLayeredData();

        if (isDataLayer(layerIndex)) {
            var regionG = renderRegionG(layerIndex);

            renderPaths(regionG, layerIndex, data);

            renderTitle(regionG, layerIndex, data);
        }
    }

    function generateLayeredData() {
        var data = {};
        var groupAll = _chart.data();
        for (var i = 0; i < groupAll.length; ++i) {
            data[_chart.keyAccessor()(groupAll[i])] = _chart.valueAccessor()(groupAll[i]);
        }
        return data;
    }

    function isDataLayer(layerIndex) {
        return geoJson(layerIndex).keyAccessor;
    }

    function renderRegionG(layerIndex) {
        var regionG = _chart.svg()
            .selectAll(layerSelector(layerIndex))
            .classed("selected", function (d) {
                return isSelected(layerIndex, d);
            })
            .classed("deselected", function (d) {
                return isDeselected(layerIndex, d);
            })
            .attr("class", function (d) {
                var layerNameClass = geoJson(layerIndex).name;
                var regionClass = dc.utils.nameToId(geoJson(layerIndex).keyAccessor(d));
                var baseClasses = layerNameClass + " " + regionClass;
                if (isSelected(layerIndex, d)) baseClasses += " selected";
                if (isDeselected(layerIndex, d)) baseClasses += " deselected";
                return baseClasses;
            });
        return regionG;
    }

    function layerSelector(layerIndex) {
        return "g.layer" + layerIndex + " g." + geoJson(layerIndex).name;
    }

    function isSelected(layerIndex, d) {
        return _chart.hasFilter() && _chart.hasFilter(getKey(layerIndex, d));
    }

    function isDeselected(layerIndex, d) {
        return _chart.hasFilter() && !_chart.hasFilter(getKey(layerIndex, d));
    }

    function getKey(layerIndex, d) {
        return geoJson(layerIndex).keyAccessor(d);
    }

    function geoJson(index) {
        return _geoJsons[index];
    }

    function renderPaths(regionG, layerIndex, data) {
        var paths = regionG
            .select("path")
            .attr("fill", function (d) {
                var currentFill = d3.select(this).attr("fill");
                if (currentFill)
                    return currentFill;
                return "none";
            })
            .on("click", function (d) {
                return _chart.onClick(d, layerIndex);
            });

        dc.transition(paths, _chart.transitionDuration()).attr("fill", function (d, i) {
            return _chart.getColor(data[geoJson(layerIndex).keyAccessor(d)], i);
        });
    }

    _chart.onClick = function (d, layerIndex) {
        var selectedRegion = geoJson(layerIndex).keyAccessor(d);
        dc.events.trigger(function () {
            _chart.filter(selectedRegion);
            dc.redrawAll(_chart.chartGroup());
        });
    };

    function renderTitle(regionG, layerIndex, data) {
        if (_chart.renderTitle()) {
            regionG.selectAll("title").text(function (d) {
                var key = getKey(layerIndex, d);
                var value = data[key];
                return _chart.title()({key: key, value: value});
            });
        }
    }

    _chart.doRedraw = function () {
        for (var layerIndex = 0; layerIndex < _geoJsons.length; ++layerIndex) {
            plotData(layerIndex);
            if(_projectionFlag) {
                _chart.svg().selectAll("g." + geoJson(layerIndex).name + " path").attr("d", _geoPath);
            }
        }
        _projectionFlag = false;
    };

    /**
    #### .overlayGeoJson(json, name, keyAccessor) - **mandatory**
    Use this function to insert a new GeoJson map layer. This function can be invoked multiple times if you have multiple GeoJson
    data layer to render on top of each other. If you overlay mutiple layers with the same name the new overlay will simply
    override the existing one.

    Parameters:
    * json - GeoJson feed
    * name - name of the layer
    * keyAccessor - accessor function used to extract "key" from the GeoJson data. Key extracted by this function should match
     the keys generated in crossfilter groups.

    ```js
    // insert a layer for rendering US states
    chart.overlayGeoJson(statesJson.features, "state", function(d) {
        return d.properties.name;
    });
    ```

    **/
    _chart.overlayGeoJson = function (json, name, keyAccessor) {
        for (var i = 0; i < _geoJsons.length; ++i) {
            if (_geoJsons[i].name == name) {
                _geoJsons[i].data = json;
                _geoJsons[i].keyAccessor = keyAccessor;
                return _chart;
            }
        }
        _geoJsons.push({name: name, data: json, keyAccessor: keyAccessor});
        return _chart;
    };

    /**
    #### .projection(projection)
    Set custom geo projection function. Available [d3 geo projection functions](https://github.com/mbostock/d3/wiki/Geo-Projections).
    Default value: albersUsa.

    **/
    _chart.projection = function (projection) {
        _geoPath.projection(projection);
        _projectionFlag = true;
        return _chart;
    };

    /**
    #### .geoJsons()
    Return all GeoJson layers currently registered with thit chart. The returned array is a reference to this chart's internal
    registration data structure without copying thus any modification to this array will also modify this chart's internal
    registration.

    Return:
    An array of objects containing fields {name, data, accessor}

    **/
    _chart.geoJsons = function () {
        return _geoJsons;
    };

    /**
    #### .removeGeoJson(name)
    Remove a GeoJson layer from this chart by name

    Return: chart instance

    **/
    _chart.removeGeoJson = function (name) {
        var geoJsons = [];

        for (var i = 0; i < _geoJsons.length; ++i) {
            var layer = _geoJsons[i];
            if (layer.name != name) {
                geoJsons.push(layer);
            }
        }

        _geoJsons = geoJsons;

        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="bubble-overlay-chart" href="#bubble-overlay-chart">#</a> Bubble Overlay Chart [Concrete] < [Abstract Bubble Chart](#abstract-bubble-chart) < [Base Chart](#base-chart)
Bubble overlay chart is quite different from the typical bubble chart. With bubble overlay chart you can arbitrarily place
a finite number of bubbles on an existing svg or bitmap image (overlay on top of it), thus losing the typical x and y
positioning that we are used to whiling retaining the capability to visualize data using it's bubble radius and
coloring.

Examples:
* [Canadian City Crime Stats](http://nickqizhu.github.com/dc.js/crime/index.html)

#### dc.bubbleOverlay(parent[, chartGroup])
Create a bubble overlay chart instance and attach it to the given parent element.

Parameters:
* parent : string - any valid d3 single selector representing typically a dom block element such as a div. Typically
   this element should also be the parent of the underlying image.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created bubble overlay chart instance

```js
// create a bubble overlay chart on top of "#chart-container1 svg" element using the default global chart group
var bubbleChart1 = dc.bubbleOverlayChart("#chart-container1").svg(d3.select("#chart-container1 svg"));
// create a bubble overlay chart on top of "#chart-container2 svg" element using chart group A
var bubbleChart2 = dc.compositeChart("#chart-container2", "chartGroupA").svg(d3.select("#chart-container2 svg"));
```

#### .svg(imageElement) - **mandatory**
Set the underlying svg image element. Unlike other dc charts this chart will not generate svg element therefore bubble overlay
chart will not work if this function is not properly invoked. If the underlying image is a bitmap, then an empty svg will need
to be manually created on top of the image.

```js
// set up underlying svg element
chart.svg(d3.select("#chart svg"));
```

**/
dc.bubbleOverlay = function(root, chartGroup) {
    var BUBBLE_OVERLAY_CLASS = "bubble-overlay";
    var BUBBLE_NODE_CLASS = "node";
    var BUBBLE_CLASS = "bubble";

    var _chart = dc.abstractBubbleChart(dc.baseChart({}));
    var _g;
    var _points = [];

    _chart.transitionDuration(750);

    _chart.radiusValueAccessor(function(d) {
        return d.value;
    });

    /**
    #### .point(name, x, y) - **mandatory**
    Set up a data point on the overlay. The name of a data point should match a specific "key" among data groups generated using keyAccessor.
    If a match is found (point name <-> data group key) then a bubble will be automatically generated at the position specified by the
    function. x and y value specified here are relative to the underlying svg.

    **/
    _chart.point = function(name, x, y) {
        _points.push({name: name, x: x, y: y});
        return _chart;
    };

    _chart.doRender = function() {
        _g = initOverlayG();

        _chart.r().range([_chart.MIN_RADIUS, _chart.width() * _chart.maxBubbleRelativeSize()]);

        initializeBubbles();

        _chart.fadeDeselectedArea();

        return _chart;
    };

    function initOverlayG() {
        _g = _chart.select("g." + BUBBLE_OVERLAY_CLASS);
        if (_g.empty())
            _g = _chart.svg().append("g").attr("class", BUBBLE_OVERLAY_CLASS);
        return _g;
    }

    function initializeBubbles() {
        var data = mapData();

        _points.forEach(function(point) {
            var nodeG = getNodeG(point, data);

            var circle = nodeG.select("circle." + BUBBLE_CLASS);

            if (circle.empty())
                circle = nodeG.append("circle")
                    .attr("class", BUBBLE_CLASS)
                    .attr("r", 0)
                    .attr("fill", _chart.getColor)
                    .on("click", _chart.onClick);

            dc.transition(circle, _chart.transitionDuration())
                .attr("r", function(d) {
                    return _chart.bubbleR(d);
                });

            _chart.doRenderLabel(nodeG);

            _chart.doRenderTitles(nodeG);
        });
    }

    function mapData() {
        var data = {};
        _chart.data().forEach(function(datum) {
            data[_chart.keyAccessor()(datum)] = datum;
        });
        return data;
    }

    function getNodeG(point, data) {
        var bubbleNodeClass = BUBBLE_NODE_CLASS + " " + dc.utils.nameToId(point.name);

        var nodeG = _g.select("g." + dc.utils.nameToId(point.name));

        if (nodeG.empty()) {
            nodeG = _g.append("g")
                .attr("class", bubbleNodeClass)
                .attr("transform", "translate(" + point.x + "," + point.y + ")");
        }

        nodeG.datum(data[point.name]);

        return nodeG;
    }

    _chart.doRedraw = function() {
        updateBubbles();

        _chart.fadeDeselectedArea();

        return _chart;
    };

    function updateBubbles() {
        var data = mapData();

        _points.forEach(function(point) {
            var nodeG = getNodeG(point, data);

            var circle = nodeG.select("circle." + BUBBLE_CLASS);

            dc.transition(circle, _chart.transitionDuration())
                .attr("r", function(d) {
                    return _chart.bubbleR(d);
                })
                .attr("fill", _chart.getColor);

            _chart.doUpdateLabels(nodeG);

            _chart.doUpdateTitles(nodeG);
        });
    }

    _chart.debug = function(flag) {
        if(flag){
            var debugG = _chart.select("g." + dc.constants.DEBUG_GROUP_CLASS);

            if(debugG.empty())
                debugG = _chart.svg()
                    .append("g")
                    .attr("class", dc.constants.DEBUG_GROUP_CLASS);

            var debugText = debugG.append("text")
                .attr("x", 10)
                .attr("y", 20);

            debugG
                .append("rect")
                .attr("width", _chart.width())
                .attr("height", _chart.height())
                .on("mousemove", function() {
                    var position = d3.mouse(debugG.node());
                    var msg = position[0] + ", " + position[1];
                    debugText.text(msg);
                });
        }else{
            _chart.selectAll(".debug").remove();
        }

        return _chart;
    };

    _chart.anchor(root, chartGroup);

    return _chart;
};

/**
## <a name="row-chart" href="#row-chart">#</a> Row Chart [Concrete] < [Color Chart](#color-chart) < [Base Chart](#base-chart)
Concrete row chart implementation.

#### dc.rowChart(parent[, chartGroup])
Create a row chart instance and attach it to the given parent element.

Parameters:

* parent : string - any valid d3 single selector representing typically a dom block element such as a div.
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed in a certain chart group then any interaction with such instance will only trigger events and redraw within the same chart group.

Return a newly created row chart instance

```js
// create a row chart under #chart-container1 element using the default global chart group
var chart1 = dc.rowChart("#chart-container1");
// create a row chart under #chart-container2 element using chart group A
var chart2 = dc.rowChart("#chart-container2", "chartGroupA");
```

**/
dc.rowChart = function (parent, chartGroup) {

    var _g;

    var _labelOffsetX = 10;

    var _labelOffsetY = 15;

    var _gap = 5;

    var _rowCssClass = "row";

    var _chart = dc.capped(dc.marginable(dc.colorChart(dc.baseChart({}))));

    var _x;

    var _elasticX;

    var _xAxis = d3.svg.axis().orient("bottom");

    var _rowData;

    _chart.rowsCap = _chart.cap;

    function calculateAxisScale() {
        if (!_x || _elasticX) {
            var extent = d3.extent(_rowData, _chart.cappedValueAccessor);
            if (extent[0] > 0) extent[0] = 0;
            _x = d3.scale.linear().domain(extent)
                .range([0, _chart.effectiveWidth()]);
        }
        _xAxis.scale(_x);
    }

    function drawAxis() {
        var axisG = _g.select("g.axis");

        calculateAxisScale();

        if (axisG.empty())
            axisG = _g.append("g").attr("class", "axis")
                .attr("transform", "translate(0, " + _chart.effectiveHeight() + ")");

        dc.transition(axisG, _chart.transitionDuration())
            .call(_xAxis);
    }

    _chart.doRender = function () {
        _chart.resetSvg();

        _g = _chart.svg()
            .append("g")
            .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")");

        drawChart();

        return _chart;
    };

    _chart.title(function (d) {
        return _chart.cappedKeyAccessor(d) + ": " + _chart.cappedValueAccessor(d);
    });

    _chart.label(_chart.cappedKeyAccessor);

    _chart.x = function(x){
        if(!arguments.length) return _x;
        _x = x;
        return _chart;
    };

    function drawGridLines() {
        _g.selectAll("g.tick")
            .select("line.grid-line")
            .remove();

        _g.selectAll("g.tick")
            .append("line")
            .attr("class", "grid-line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", function () {
                return -_chart.effectiveHeight();
            });
    }

    function drawChart() {
        _rowData = _chart.data();

        drawAxis();
        drawGridLines();

        var rows = _g.selectAll("g." + _rowCssClass)
            .data(_rowData);

        createElements(rows);
        removeElements(rows);
        updateElements(rows);
    }

    function createElements(rows) {
        var rowEnter = rows.enter()
            .append("g")
            .attr("class", function (d, i) {
                return _rowCssClass + " _" + i;
            });

        rowEnter.append("rect").attr("width", 0);

        createLabels(rowEnter);
        updateLabels(rows);
    }

    function removeElements(rows) {
        rows.exit().remove();
    }

    function updateElements(rows) {
        var n = _rowData.length;

        var height = (_chart.effectiveHeight() - (n + 1) * _gap) / n;

        var rect = rows.attr("transform",function (d, i) {
                return "translate(0," + ((i + 1) * _gap + i * height) + ")";
            }).select("rect")
            .attr("height", height)
            .attr("fill", _chart.getColor)
            .on("click", onClick)
            .classed("deselected", function (d) {
                return (_chart.hasFilter()) ? !isSelectedRow(d) : false;
            })
            .classed("selected", function (d) {
                return (_chart.hasFilter()) ? isSelectedRow(d) : false;
            });

        dc.transition(rect, _chart.transitionDuration())
            .attr("width", function (d) {
                var start = _x(0) == -Infinity ? _x(1) : _x(0);
                return Math.abs(start - _x(_chart.valueAccessor()(d)));
            })
            .attr("transform", translateX);

        createTitles(rows);
        updateLabels(rows);
    }

    function createTitles(rows) {
        if (_chart.renderTitle()) {
            rows.selectAll("title").remove();
            rows.append("title").text(_chart.title());
        }
    }

    function createLabels(rowEnter) {
        if (_chart.renderLabel()) {
            rowEnter.append("text")
                .on("click", onClick);
        }
    }

    function updateLabels(rows) {
        if (_chart.renderLabel()) {
            var lab = rows.select("text")
                .attr("x", _labelOffsetX)
                .attr("y", _labelOffsetY)
                .on("click", onClick)
                .attr("class", function (d, i) {
                    return _rowCssClass + " _" + i;
                })
                .text(function (d) {
                    return _chart.label()(d);
                });
            dc.transition(lab, _chart.transitionDuration())
                .attr("transform", translateX);
        }
    }

    function onClick(d) {
        _chart.onClick(d);
    }

    function translateX(d) {
        var x = _x(_chart.cappedValueAccessor(d)),
            x0 = _x(0),
            s = x > x0 ? x0 : x;
        return "translate("+s+",0)";
    }

    _chart.doRedraw = function () {
        drawChart();
        return _chart;
    };

    _chart.xAxis = function () {
        return _xAxis;
    };

    /**
    #### .gap([gap])
    Get or set the vertical gap space between rows on a particular row chart instance. Default gap is 5px;

    **/
    _chart.gap = function (g) {
        if (!arguments.length) return _gap;
        _gap = g;
        return _chart;
    };

    /**
    #### .elasticX([boolean])
    Get or set the elasticity on x axis. If this attribute is set to true, then the x axis will rescle to auto-fit the data
    range when filtered.

    **/
    _chart.elasticX = function (_) {
        if (!arguments.length) return _elasticX;
        _elasticX = _;
        return _chart;
    };

    /**
    #### .labelOffsetX([x])
    Get or set the x offset (horizontal space to the top left corner of a row) for labels on a particular row chart. Default x offset is 10px;

    **/
    _chart.labelOffsetX = function (o) {
        if (!arguments.length) return _labelOffsetX;
        _labelOffsetX = o;
        return _chart;
    };

    /**
    #### .labelOffsetY([y])
    Get of set the y offset (vertical space to the top left corner of a row) for labels on a particular row chart. Default y offset is 15px;

    **/
    _chart.labelOffsetY = function (o) {
        if (!arguments.length) return _labelOffsetY;
        _labelOffsetY = o;
        return _chart;
    };

    function isSelectedRow (d) {
        return _chart.hasFilter(_chart.cappedKeyAccessor(d));
    }

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="legend" href="#legend">#</a> Legend [Concrete]
Legend is a attachable widget that can be added to other dc charts to render horizontal legend labels.

```js
chart.legend(dc.legend().x(400).y(10).itemHeight(13).gap(5))
```

Examples:
* [Nasdaq 100 Index](http://nickqizhu.github.com/dc.js/)
* [Canadian City Crime Stats](http://nickqizhu.github.com/dc.js/crime/index.html)

**/
dc.legend = function () {
    var LABEL_GAP = 2;

    var _legend = {},
        _parent,
        _x = 0,
        _y = 0,
        _itemHeight = 12,
        _gap = 5;

    var _g;

    _legend.parent = function (p) {
        if (!arguments.length) return _parent;
        _parent = p;
        return _legend;
    };

    _legend.render = function () {
        _parent.svg().select("g.dc-legend").remove();
        _g = _parent.svg().append("g")
            .attr("class", "dc-legend")
            .attr("transform", "translate(" + _x + "," + _y + ")");

        var itemEnter = _g.selectAll('g.dc-legend-item')
            .data(_parent.legendables())
            .enter()
            .append("g")
            .attr("class", "dc-legend-item")
            .attr("transform", function (d, i) {
                return "translate(0," + i * legendItemHeight() + ")";
            })
            .on("mouseover", function(d){
                _parent.legendHighlight(d);
            })
            .on("mouseout", function (d) {
                _parent.legendReset(d);
            });

        itemEnter
            .append("rect")
                .attr("width", _itemHeight)
                .attr("height", _itemHeight)
                .attr("fill", function(d){return d.color;});

        itemEnter.append("text")
                .text(function(d){return d.name;})
                .attr("x", _itemHeight + LABEL_GAP)
                .attr("y", function(){return _itemHeight / 2 + (this.clientHeight?this.clientHeight:13) / 2 - 2;});
    };

    function legendItemHeight() {
        return _gap + _itemHeight;
    }

    /**
    #### .x([value])
    Set or get x coordinate for legend widget. Default value: 0.
    **/
    _legend.x = function (x) {
        if (!arguments.length) return _x;
        _x = x;
        return _legend;
    };

    /**
    #### .y([value])
    Set or get y coordinate for legend widget. Default value: 0.
    **/
    _legend.y = function (y) {
        if (!arguments.length) return _y;
        _y = y;
        return _legend;
    };

    /**
    #### .gap([value])
    Set or get gap between legend items. Default value: 5.
    **/
    _legend.gap = function (gap) {
        if (!arguments.length) return _gap;
        _gap = gap;
        return _legend;
    };

    /**
    #### .itemHeight([value])
    Set or get legend item height. Default value: 12.
    **/
    _legend.itemHeight = function (h) {
        if (!arguments.length) return _itemHeight;
        _itemHeight = h;
        return _legend;
    };

    return _legend;
};

/**
## <a name="capped" href="#capped">#</a>  Capped

Capped is a mixin that groups small data elements below a _cap_ into an *others* grouping for both the Row and Pie Charts.

The top ordered elements in the group up to the cap amount will be kept in the chart and
the sum of those below will be added to the *others* element. The keys of the elements below the cap limit are recorded
in order to repsond to onClick events and trigger filtering of all the within that grouping.

**/
dc.capped = function (_chart) {

    var _cap = Infinity;

    var _othersLabel = "Others";

    var _othersGrouper = function (topRows) {
        var topRowsSum = d3.sum(topRows, _chart.valueAccessor()),
            allRows = _chart.group().all(),
            allRowsSum = d3.sum(allRows, _chart.valueAccessor()),
            topKeys = topRows.map(_chart.keyAccessor()),
            allKeys = allRows.map(_chart.keyAccessor()),
            topSet = d3.set(topKeys),
            others = allKeys.filter(function(d){return !topSet.has(d);});
        if (allRowsSum > topRowsSum)
            return topRows.concat([{"others": others, "key": _othersLabel, "value": allRowsSum - topRowsSum}]);
        return topRows;
    };

    _chart.cappedKeyAccessor = function(d,i) {
        if (d.others)
            return d.key;
        return _chart.keyAccessor()(d,i);
    };

    _chart.cappedValueAccessor = function(d,i) {
        if (d.others)
            return d.value;
        return _chart.valueAccessor()(d,i);
    };

    _chart.data(function(group) {
        if (_cap == Infinity) {
            return _chart.computeOrderedGroups(group.all());
        } else {
            var topRows = group.top(_cap); // ordered by crossfilter group order (default value)
            topRows = _chart.computeOrderedGroups(topRows); // re-order using ordering (default key)
            if (_othersGrouper) return _othersGrouper(topRows);
            return topRows;
        }
    });

    /**
    #### .cap([count])
    Get or set the count of elements to that will be included in the cap.
    **/
    _chart.cap = function (_) {
        if (!arguments.length) return _cap;
        _cap = _;
        return _chart;
    };

    /**
    #### .othersLabel([label])
    Get or set the label for *Others* slice when slices cap is specified. Default label is **Others**.
    **/
    _chart.othersLabel = function (_) {
        if (!arguments.length) return _othersLabel;
        _othersLabel = _;
        return _chart;
    };

    /**
    #### .othersGrouper([grouperFunction])
    Get or set the grouper function that will perform the insertion of data for the *Others* slice if the slices cap is
    specified. If set to a falsy value, no others will be added. By default the grouper function computes the sum of all
    values below the cap.
    ```js
    chart.othersGrouper(function (data) {
        // compute the value for others, presumably the sum of all values below the cap
        var othersSum  = yourComputeOthersValueLogic(data)

        // the keys are needed to properly filter when the others element is clicked
        var othersKeys = yourComputeOthersKeysArrayLogic(data);

        // add the others row to the dataset
        data.push({"key": "Others", "value": othersSum, "others": othersKeys });

        return data;
    });
    ```
    **/
    _chart.othersGrouper = function (_) {
        if (!arguments.length) return _othersGrouper;
        _othersGrouper = _;
        return _chart;
    };

    dc.override(_chart, "onClick", function (d) {
        if (d.others)
            _chart.filter([d.others]);
        _chart._onClick(d);
    });

    return _chart;
};

dc.scatterPlot = function (parent, chartGroup) {
    var _chart = dc.coordinateGridChart({});

    var _locator = function (d) {
        return "translate(" + _chart.x()(_chart.keyAccessor()(d)) + "," + _chart.y()(_chart.valueAccessor()(d)) + ")";
    };

    var _symbolSize = 3;

    _chart.transitionDuration(0); // turn off transition by default for scatterplot

    _chart.plotData = function () {
        var symbols = _chart.chartBodyG().selectAll("circle.symbol")
            .data(_chart.data());

        symbols
            .enter()
        .append("circle")
            .attr("class", "symbol")
            .attr("fill", _chart.getColor(0))
            .attr("transform", _locator);

        dc.transition(symbols, _chart.transitionDuration())
            .attr("transform", _locator)
            .attr("r", _symbolSize);

        dc.transition(symbols.filter(function(d){return _chart.valueAccessor()(d) === 0;}), _chart.transitionDuration())
                    .attr("r", 0).remove(); // remove empty groups

        dc.transition(symbols.exit(), _chart.transitionDuration())
            .attr("r", 0).remove();
    };

    /**
    #### .symbolSize([radius])
    Set or get radius for symbols, default: 3.

    **/
    _chart.symbolSize = function(s){
        if(!arguments.length) return _symbolSize;
        _symbolSize = s;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};

/**
## <a name="number-display" href="#number-display">#</a> Number Display [Concrete] < [Base Chart](#base-chart)
A display of a single numeric value.

Examples:

* [Test Example](http://nickqizhu.github.io/dc.js/examples/number.html)

#### dc.numberDisplay(parent[, chartGroup])
Create a Number Display instance and attach it to the given parent element.

Unlike other charts, you do not need to set a dimension. Instead a valid group object must be provided and valueAccessor that is expected to return a single value.

Parameters:

* parent : string - any valid d3 single selector representing typically a dom block element such as a div or span
* chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
   in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
   chart group.

Return:
A newly created number display instance

```js
// create a number display under #chart-container1 element using the default global chart group
var display1 = dc.numberDisplay("#chart-container1");
```

**/
dc.numberDisplay = function (parent, chartGroup) {
    var SPAN_CLASS = 'number-display';
    var _formatNumber = d3.format(".2s");
    var _chart = dc.baseChart({});

    // dimension not required
    _chart._mandatoryAttributes(['group']);

    /**
    #### .value()
    Calculate and return the underlying value of the display
    **/
    _chart.value = function () {
        return _chart.data();
    };

    _chart.data(function (group) {
        var valObj = group.value ? group.value() : group.top(1)[0];
        return _chart.valueAccessor()(valObj);
    });

    _chart.transitionDuration(250); // good default

    _chart.doRender = function () {
        var newValue = _chart.value(),
            span     = _chart.selectAll("."+SPAN_CLASS);

        if(span.empty())
            span = span.data([0])
                .enter()
                .append("span")
                .attr("class", SPAN_CLASS);

        span.transition()
            .duration(_chart.transitionDuration())
            .ease('quad-out-in')
            .tween("text", function () {
                var interp = d3.interpolateNumber(this.lastValue || 0, newValue);
                this.lastValue = newValue;
                return function (t) {
                    this.textContent = _chart.formatNumber()(interp(t));
                };
            });

        return _chart;
    };

    _chart.doRedraw = function(){
        return _chart.doRender();
    };

    /**
    #### .formatNumber([formatter])
    Get or set a function to format the value for the display. By default `d3.format(".2s");` is used.

    **/
    _chart.formatNumber = function (_) {
        if (!arguments.length) return _formatNumber;
        _formatNumber = _;
        return _chart;
    };

    return _chart.anchor(parent, chartGroup);
};


/**
 ## <a name="heatmap" href="#heatmap">#</a> Heat Map [Concrete] < [Color Chart](#color-chart) < [Base Chart](#base-chart)
 A heat map is matrix that represents the values of two dimensions of data using colors.

 #### dc.heatMap(parent[, chartGroup])
 Create a heat map instance and attach it to the given parent element.

 Parameters:
 * parent : string - any valid d3 single selector representing typically a dom block element such as a div.
 * chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
 in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
 chart group.

 Return:
 A newly created heat map instance

 ```js
 // create a heat map under #chart-container1 element using the default global chart group
 var heatMap1 = dc.heatMap("#chart-container1");
 // create a heat map under #chart-container2 element using chart group A
 var heatMap2 = dc.heatMap("#chart-container2", "chartGroupA");
 ```

 **/
dc.heatMap = function (parent, chartGroup) {

    var _chartBody;

    var _cols;
    var _rows;

    var _chart = dc.colorChart(dc.marginable(dc.baseChart({})));
    _chart._mandatoryAttributes(['group']);
    _chart.title(_chart.colorAccessor());

    _chart.boxOnClick = function () {};
    _chart.xAxisOnClick = function () {};
    _chart.yAxisOnClick = function () {};

    //_chart.colors(d3.scale.quantize().range(["#a50026","#d73027","#f46d43","#fdae61","#fee08b",
    //                                         "#ffffbf","#d9ef8b","#a6d96a","#66bd63","#1a9850","#006837"]));

    function uniq(d,i,a) {
        return !i || a[i-1] != d;
    }

    _chart.rows = function (_) {
        if (arguments.length) {
            _rows = _;
            return _chart;
        }
        if (_rows) return _rows;
        var rowValues = _chart.data().map(_chart.valueAccessor());
        rowValues.sort(d3.ascending);
        return d3.scale.ordinal().domain(rowValues.filter(uniq));
    };

    _chart.cols = function (_) {
        if (arguments.length) {
            _cols = _;
            return _chart;
        }
        if (_cols) return _cols;
        var colValues = _chart.data().map(_chart.keyAccessor());
        colValues.sort(d3.ascending);
        return d3.scale.ordinal().domain(colValues.filter(uniq));
    };

    _chart.doRender = function () {
        _chart.resetSvg();

        _chartBody = _chart.svg()
          .append("g")
          .attr("class", "heatmap")
          .attr("transform", "translate(" + _chart.margins().left + "," + _chart.margins().top + ")");

        return _chart.doRedraw();
    };

    _chart.doRedraw = function () {
        var rows = _chart.rows(),
            cols = _chart.cols(),
            rowCount = rows.domain().length,
            colCount = cols.domain().length,
            boxWidth = Math.floor(_chart.effectiveWidth() / colCount),
            boxHeight = Math.floor(_chart.effectiveHeight() / rowCount);

        cols.rangeRoundBands([0, _chart.effectiveWidth()]);
        rows.rangeRoundBands([_chart.effectiveHeight(), 0]);
        //_chart.colors().domain(d3.extent(_chart.data(),_chart.colorAccessor()));

        var boxes = _chartBody.selectAll("g.box-group").data(_chart.data(), function(d,i) {
            return _chart.keyAccessor()(d,i) + '\0' + _chart.valueAccessor()(d,i);
        });
        var gEnter = boxes.enter().append("g")
            .attr("class", "box-group");
        gEnter.append("rect")
            .attr("fill", "white")
            .on("click", _chart.boxOnClick);
        gEnter.append("title")
            .text(function (d) { return _chart.title()(d); });

        dc.transition(boxes.select("rect"), _chart.transitionDuration())
            .attr("class","heat-box")
            .attr("x", function(d,i) { return cols(_chart.keyAccessor()(d,i)); })
            .attr("y", function(d,i) { return rows(_chart.valueAccessor()(d,i)); })
            .attr("rx", 0.15 * boxWidth)
            .attr("ry", 0.15 * boxHeight)
            .attr("fill", _chart.getColor)
            .attr("width", boxWidth)
            .attr("height", boxHeight);

        boxes.exit().remove();

        var gCols = _chartBody.selectAll("g.cols");
        if (gCols.empty())
            gCols = _chartBody.append("g").attr("class", "cols axis");
        gCols.selectAll('text').data(cols.domain())
            .enter().append("text")
              .attr("x", function(d) { return cols(d) + boxWidth/2; })
              .style("text-anchor", "middle")
              .attr("y", _chart.effectiveHeight())
              .attr("dy", 12)
              .on("click", _chart.xAxisOnClick)
              .text(function(d) { return d; });
        var gRows = _chartBody.selectAll("g.rows");
        if (gRows.empty())
            gRows = _chartBody.append("g").attr("class", "rows axis");
        gRows.selectAll('text').data(rows.domain())
            .enter().append("text")
              .attr("y", function(d) { return rows(d) + boxHeight/2; })
              .attr("dy", 6)
              .style("text-anchor", "end")
              .attr("x", 0)
              .attr("dx", -2)
              .on("click", _chart.yAxisOnClick)
              .text(function(d) { return d; });
    };

    return _chart.anchor(parent, chartGroup);
};

// https://raw.github.com/d3/d3-plugins/56f25a3b54446c921e23a7360f1a0dea2508870f/box/box.js
(function() {

// Inspired by http://informationandvisualization.de/blog/box-plot
d3.box = function() {
  var width = 1,
      height = 1,
      duration = 0,
      domain = null,
      value = Number,
      whiskers = boxWhiskers,
      quartiles = boxQuartiles,
      tickFormat = null;

  // For each small multiple…
  function box(g) {
    g.each(function(d, i) {
      d = d.map(value).sort(d3.ascending);
      var g = d3.select(this),
          n = d.length,
          min = d[0],
          max = d[n - 1];

      // Compute quartiles. Must return exactly 3 elements.
      var quartileData = d.quartiles = quartiles(d);

      // Compute whiskers. Must return exactly 2 elements, or null.
      var whiskerIndices = whiskers && whiskers.call(this, d, i),
          whiskerData = whiskerIndices && whiskerIndices.map(function(i) { return d[i]; });

      // Compute outliers. If no whiskers are specified, all data are "outliers".
      // We compute the outliers as indices, so that we can join across transitions!
      var outlierIndices = whiskerIndices
          ? d3.range(0, whiskerIndices[0]).concat(d3.range(whiskerIndices[1] + 1, n))
          : d3.range(n);

      // Compute the new x-scale.
      var x1 = d3.scale.linear()
          .domain(domain && domain.call(this, d, i) || [min, max])
          .range([height, 0]);

      // Retrieve the old x-scale, if this is an update.
      var x0 = this.__chart__ || d3.scale.linear()
          .domain([0, Infinity])
          .range(x1.range());

      // Stash the new scale.
      this.__chart__ = x1;

      // Note: the box, median, and box tick elements are fixed in number,
      // so we only have to handle enter and update. In contrast, the outliers
      // and other elements are variable, so we need to exit them! Variable
      // elements also fade in and out.

      // Update center line: the vertical line spanning the whiskers.
      var center = g.selectAll("line.center")
          .data(whiskerData ? [whiskerData] : []);

      center.enter().insert("line", "rect")
          .attr("class", "center")
          .attr("x1", width / 2)
          .attr("y1", function(d) { return x0(d[0]); })
          .attr("x2", width / 2)
          .attr("y2", function(d) { return x0(d[1]); })
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .style("opacity", 1)
          .attr("y1", function(d) { return x1(d[0]); })
          .attr("y2", function(d) { return x1(d[1]); });

      center.transition()
          .duration(duration)
          .style("opacity", 1)
          .attr("y1", function(d) { return x1(d[0]); })
          .attr("y2", function(d) { return x1(d[1]); });

      center.exit().transition()
          .duration(duration)
          .style("opacity", 1e-6)
          .attr("y1", function(d) { return x1(d[0]); })
          .attr("y2", function(d) { return x1(d[1]); })
          .remove();

      // Update innerquartile box.
      var box = g.selectAll("rect.box")
          .data([quartileData]);

      box.enter().append("rect")
          .attr("class", "box")
          .attr("x", 0)
          .attr("y", function(d) { return x0(d[2]); })
          .attr("width", width)
          .attr("height", function(d) { return x0(d[0]) - x0(d[2]); })
        .transition()
          .duration(duration)
          .attr("y", function(d) { return x1(d[2]); })
          .attr("height", function(d) { return x1(d[0]) - x1(d[2]); });

      box.transition()
          .duration(duration)
          .attr("y", function(d) { return x1(d[2]); })
          .attr("height", function(d) { return x1(d[0]) - x1(d[2]); });

      // Update median line.
      var medianLine = g.selectAll("line.median")
          .data([quartileData[1]]);

      medianLine.enter().append("line")
          .attr("class", "median")
          .attr("x1", 0)
          .attr("y1", x0)
          .attr("x2", width)
          .attr("y2", x0)
        .transition()
          .duration(duration)
          .attr("y1", x1)
          .attr("y2", x1);

      medianLine.transition()
          .duration(duration)
          .attr("y1", x1)
          .attr("y2", x1);

      // Update whiskers.
      var whisker = g.selectAll("line.whisker")
          .data(whiskerData || []);

      whisker.enter().insert("line", "circle, text")
          .attr("class", "whisker")
          .attr("x1", 0)
          .attr("y1", x0)
          .attr("x2", width)
          .attr("y2", x0)
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .attr("y1", x1)
          .attr("y2", x1)
          .style("opacity", 1);

      whisker.transition()
          .duration(duration)
          .attr("y1", x1)
          .attr("y2", x1)
          .style("opacity", 1);

      whisker.exit().transition()
          .duration(duration)
          .attr("y1", x1)
          .attr("y2", x1)
          .style("opacity", 1e-6)
          .remove();

      // Update outliers.
      var outlier = g.selectAll("circle.outlier")
          .data(outlierIndices, Number);

      outlier.enter().insert("circle", "text")
          .attr("class", "outlier")
          .attr("r", 5)
          .attr("cx", width / 2)
          .attr("cy", function(i) { return x0(d[i]); })
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .attr("cy", function(i) { return x1(d[i]); })
          .style("opacity", 1);

      outlier.transition()
          .duration(duration)
          .attr("cy", function(i) { return x1(d[i]); })
          .style("opacity", 1);

      outlier.exit().transition()
          .duration(duration)
          .attr("cy", function(i) { return x1(d[i]); })
          .style("opacity", 1e-6)
          .remove();

      // Compute the tick format.
      var format = tickFormat || x1.tickFormat(8);

      // Update box ticks.
      var boxTick = g.selectAll("text.box")
          .data(quartileData);

      boxTick.enter().append("text")
          .attr("class", "box")
          .attr("dy", ".3em")
          .attr("dx", function(d, i) { return i & 1 ? 6 : -6; })
          .attr("x", function(d, i) { return i & 1 ? width : 0; })
          .attr("y", x0)
          .attr("text-anchor", function(d, i) { return i & 1 ? "start" : "end"; })
          .text(format)
        .transition()
          .duration(duration)
          .attr("y", x1);

      boxTick.transition()
          .duration(duration)
          .text(format)
          .attr("y", x1);

      // Update whisker ticks. These are handled separately from the box
      // ticks because they may or may not exist, and we want don't want
      // to join box ticks pre-transition with whisker ticks post-.
      var whiskerTick = g.selectAll("text.whisker")
          .data(whiskerData || []);

      whiskerTick.enter().append("text")
          .attr("class", "whisker")
          .attr("dy", ".3em")
          .attr("dx", 6)
          .attr("x", width)
          .attr("y", x0)
          .text(format)
          .style("opacity", 1e-6)
        .transition()
          .duration(duration)
          .attr("y", x1)
          .style("opacity", 1);

      whiskerTick.transition()
          .duration(duration)
          .text(format)
          .attr("y", x1)
          .style("opacity", 1);

      whiskerTick.exit().transition()
          .duration(duration)
          .attr("y", x1)
          .style("opacity", 1e-6)
          .remove();
    });
    d3.timer.flush();
  }

  box.width = function(x) {
    if (!arguments.length) return width;
    width = x;
    return box;
  };

  box.height = function(x) {
    if (!arguments.length) return height;
    height = x;
    return box;
  };

  box.tickFormat = function(x) {
    if (!arguments.length) return tickFormat;
    tickFormat = x;
    return box;
  };

  box.duration = function(x) {
    if (!arguments.length) return duration;
    duration = x;
    return box;
  };

  box.domain = function(x) {
    if (!arguments.length) return domain;
    domain = x == null ? x : d3.functor(x);
    return box;
  };

  box.value = function(x) {
    if (!arguments.length) return value;
    value = x;
    return box;
  };

  box.whiskers = function(x) {
    if (!arguments.length) return whiskers;
    whiskers = x;
    return box;
  };

  box.quartiles = function(x) {
    if (!arguments.length) return quartiles;
    quartiles = x;
    return box;
  };

  return box;
};

function boxWhiskers(d) {
  return [0, d.length - 1];
}

function boxQuartiles(d) {
  return [
    d3.quantile(d, .25),
    d3.quantile(d, .5),
    d3.quantile(d, .75)
  ];
}

})();

/**
 ## <a name="boxplot" href="#boxplot">#</a> Box Plot [Concrete] < [CoordinateGrid Chart](#coordinate-grid-chart)
 A box plot is a chart that depicts numerical data via their quartile ranges.

 #### dc.boxPlot(parent[, chartGroup])
 Create a box plot instance and attach it to the given parent element.

 Parameters:
 * parent : string - any valid d3 single selector representing typically a dom block element such as a div.
 * chartGroup : string (optional) - name of the chart group this chart instance should be placed in. Once a chart is placed
 in a certain chart group then any interaction with such instance will only trigger events and redraw within the same
 chart group.

 Return:
 A newly created box plot instance

 ```js
 // create a box plot under #chart-container1 element using the default global chart group
 var boxPlot1 = dc.boxPlot("#chart-container1");
 // create a box plot under #chart-container2 element using chart group A
 var boxPlot2 = dc.boxPlot("#chart-container2", "chartGroupA");
 ```

 **/
dc.boxPlot = function (parent, chartGroup) {
    var _chart = dc.coordinateGridChart({});

    var _whisker_iqr_factor = 1.5;
    var _whiskers_iqr = default_whiskers_iqr;
    var _whiskers = _whiskers_iqr(_whisker_iqr_factor);

    var _box = d3.box();
    var _boxWidth = function (innerChartWidth, xUnits) {
        if (_chart.isOrdinal())
            return _chart.x().rangeBand();
        else
            return innerChartWidth / (1 + _chart.boxPadding()) / xUnits;
    };

    // default padding to handle min/max whisker text
    _chart.yAxisPadding(12);

    // default to ordinal
    _chart.x(d3.scale.ordinal());
    _chart.xUnits(dc.units.ordinal);

    // valueAccessor should return an array of values that can be coerced into numbers
    //  or if data is overloaded for a static array of arrays, it should be `Number`
    _chart.data(function(group) {
        return group.all().map(function (d) {
            d.map = function(accessor) { return accessor.call(d,d); };
            return d;
        });
    });

    /**
    ### .boxPadding([padding])
    Get or set the spacing between boxes as a fraction of bar size. Valid values are within 0-1.
    See the [d3 docs](https://github.com/mbostock/d3/wiki/Ordinal-Scales#wiki-ordinal_rangeBands)
    for a visual description of how the padding is applied.

    Default: 0.8
    **/
    _chart.boxPadding = _chart._rangeBandPadding;
    _chart.boxPadding(0.8);

    /**
    ### .outerPadding([padding])
    Get or set the outer padding on an ordinal box chart. This setting has no effect on non-ordinal charts
    or on charts with a custom `.boxWidth`. Padding equivlent in width to `padding * barWidth` will be
    added on each side of the chart.

    Default: 0.5
    **/
    _chart.outerPadding = _chart._outerRangeBandPadding;
    _chart.outerPadding(0.5);

    /**
     #### .boxWidth(width || function(innerChartWidth, xUnits) { ... })
     Get or set the numerical width of the boxplot box. Provided width may also be a function.
     This function takes as parameters the chart width without the right and left margins
     as well as the number of x units.
     **/
    _chart.boxWidth = function(_) {
        if (!arguments.length) return _boxWidth;
        _boxWidth = d3.functor(_);
        return _chart;
    };

    _chart.plotData = function () {
        var _calculatedBoxWidth = _boxWidth(_chart.effectiveWidth(), _chart.xUnitCount());

        _box.whiskers(_whiskers)
            .width(_calculatedBoxWidth)
            .height(_chart.effectiveHeight())
            .value(_chart.valueAccessor())
            .domain(_chart.y().domain());

        var boxTransform = function (d, i) {
            var xOffset = _chart.x()(_chart.keyAccessor()(d,i));
            return "translate(" + xOffset + ",0)";
        };

        _chart.chartBodyG().selectAll('g.box')
            .data(_chart.data())
          .enter().append("g")
            .attr("class", "box")
            .attr("transform", boxTransform)
            .call(_box);
    };

    _chart.yAxisMin = function () {
        var min = d3.min(_chart.data(), function (e) {
            return d3.min(_chart.valueAccessor()(e));
        });
        return dc.utils.subtract(min, _chart.yAxisPadding());
    };

    _chart.yAxisMax = function () {
        var max = d3.max(_chart.data(), function (e) {
            return d3.max(_chart.valueAccessor()(e));
        });
        return dc.utils.add(max, _chart.yAxisPadding());
    };

    // Returns a function to compute the interquartile range.
    function default_whiskers_iqr(k) {
        return function (d) {
            var q1 = d.quartiles[0],
                q3 = d.quartiles[2],
                iqr = (q3 - q1) * k,
                i = -1,
                j = d.length;
            while (d[++i] < q1 - iqr);
            while (d[--j] > q3 + iqr);
            return [i, j];
        };
    }

    return _chart.anchor(parent, chartGroup);
};

return dc;})();
