# This Python file uses the following encoding: utf-8

# TODO: export to csv file for R

# TODO: rewrite all the date/time crap

import shelve
import math
import time
import datetime
import pkg_resources
import StringIO

import cherrypy
from mako.template import Template
import matplotlib
#matplotlib.use("SVG")
import matplotlib.pyplot as plt

def floatToDateString(f):
    t = time.localtime(f)
    return "%s-%s-%s" % (t[0], t[1], t[2])

def normalizeIntervals(intervals):
    newIntervals = []
    for i in intervals:
        if i[1] < 60*60*24:
            newIntervals.append(i)
        else:
            dt = datetime.datetime.fromtimestamp(i[0])
            e = i[0] + i[1]
            while time.mktime(dt.timetuple()) < e:
                t = time.mktime(dt.timetuple())
                dt = dt.replace(hour = 23, minute = 59, second = 59)
                if time.mktime(dt.timetuple()) > e:
                    dt = datetime.datetime.fromtimestamp(e)
                newIntervals.append((t,
                                     time.mktime(dt.timetuple()) - t,
                                     i[2]))
                dt = dt + datetime.timedelta(seconds = 1)
    return newIntervals

def getIntervals(logData, start, end):
    # State machine states
    ANNOTALD_CLOSED = 0
    ANNOTALD_OPEN = 1
    ANNOTALD_IDLE = 2

    interesting_events = ["page-load",
                          "page-unload",
                          "user-idle",
                          "user-resume",
                          "auto-idle",
                          "auto-resume"]
    
    keys = logData.keys()
    keys.sort()
    start = float(time.mktime(start))
    end = float(time.mktime(end))
    keys = filter(lambda x: float(x) > start and float(x) < end, keys)
    keys = filter(lambda k: logData[k]['type'] in interesting_events, keys)

    intervals = []
    state = ANNOTALD_CLOSED
    print keys
    for k in keys:
        typ = logData[k]['type']
        print typ
        if state == ANNOTALD_CLOSED:
            if typ in ["page-load"]:
                print "open"
                state = ANNOTALD_OPEN
                begTime = float(k)
            else:
                pass
                #raise PlotError("Incoherent log") # TODO: this is quite strict
        elif state == ANNOTALD_OPEN:
            if typ in ["page-unload"]:
                print "unload"
                state = ANNOTALD_CLOSED
                intervals.append((begTime, float(k) - begTime, "working"))
            elif typ in ["user-idle","auto-idle"]:
                print "idle"
                state = ANNOTALD_IDLE
                intervals.append((begTime, float(k) - begTime, "working"))
                begTime = float(k)
            else:
                pass
                #raise PlotError("Incoherent log")
        elif state == ANNOTALD_IDLE:
            if typ in ["page-unload"]:
                print "unload"
                state = ANNOTALD_CLOSED
                intervals.append((begTime, float(k) - begTime, "idle"))
            elif typ in ["user-resume","auto-resume"]:
                print "open"
                state = ANNOTALD_OPEN
                intervals.append((begTime, float(k) - begTime, "idle"))
                begTime = float(k)
            else:
                pass
                #raise PlotError("Incoherent log")

    if state == ANNOTALD_OPEN:
        intervals.append((begTime, end - begTime, "working"))
    if state == ANNOTALD_IDLE:
        intervals.append((begTime, end - begTime, "idle"))
    print intervals

    intervals = normalizeIntervals(intervals)

    def addDay(i):
        t = time.strftime("%Y-%m-%d", time.gmtime(i[0]))
        return i + (t,)

    intervals = map(addDay, intervals)

    return intervals

def breakIntervals(intervals):
    days = set(map(lambda i: i[3], intervals))
    days = list(days)
    days.sort()
    def absToDay(i):
        dt = datetime.datetime.fromtimestamp(i[0])
        dt = dt.replace(hour = 0, minute = 0, second = 0)
        return (i[0] - time.mktime(dt.timetuple()),) + i[1:]
    return [[absToDay(i) for i in intervals if i[3] == day] for day in days]


def timeline(logData, **kwargs):
    try:
        start = time.strptime(kwargs['startdate'] + " 00:00:00", "%Y-%m-%d %H:%M:%S")
        end = time.strptime(kwargs['enddate'] + " 23:59:59", "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise PlotError("Invalid date format.")
    intervals = getIntervals(logData, start, end)

    brokenIntervals = breakIntervals(intervals)

    plt.figure(figsize=(15,4))
    axis = plt.gca()
    yt = []
    ytl = []
    for (i, j) in zip(brokenIntervals, range(len(brokenIntervals))):
        plt.broken_barh(map(lambda x: x[0:2], filter(lambda x: x[2] == "working", i)),
                        (j-0.4, 0.8), facecolors = 'green')
        plt.broken_barh(map(lambda x: x[0:2], filter(lambda x: x[2] == "idle", i)),
                        (j-0.4, 0.8), facecolors = 'red')
    tmp = datetime.datetime.fromtimestamp(time.mktime(start))
    tmp2 = 0
    while tmp < datetime.datetime.fromtimestamp(time.mktime(end)):
        yt.append(tmp2)
        tmp2 = tmp2 + 1
        ytl.append(tmp.strftime("%Y-%m-%d"))
        tmp = tmp + datetime.timedelta(days = 1)
    axis.set_xlim(0, 60*60*24)
    axis.set_ylim(-0.5, len(intervals) + 0.5)
    axis.set_yticks(yt)
    axis.set_yticklabels(ytl)
    axis.set_xticks([0, 60*60*6, 60*60*12, 60*60*18, 60*60*24])
    axis.set_xticklabels(["12AM", "6AM", "12PM", "6PM", "12AM"])
    plotstr = StringIO.StringIO()
    plt.savefig(plotstr, format = 'svg', bbox_inches = 'tight')

    ps = "\n".join(plotstr.getvalue().split("\n")[3:])

    return (ps +
            "<br /><br />Total of %s seconds of annotating over %s days" %
            (round(reduce(lambda x, y: x + y, map(lambda p: p[1],
                                                  filter(lambda i: i[2] == "working", intervals)),
                          0),
                   0),
             round((time.mktime(end) - time.mktime(start)) / (60*60*24), 0))).decode("utf-8")
    
    

allPlots = {
    "Idle/active timeline": timeline
}

class PlotError(Exception):
    def __init__(self, msg):
        self.message = msg

def formatPlotError(err):
    return "<div style='color:red;'>" + e.message + "</div>"

def formatPlot(name, plot):
    return "".join(["<div class='plottitle'>",
                    name,
                    "</div>",
                    plot
                ])

def plotPage(evtlog, **formData):
    plotTemplate = Template(filename = pkg_resources.resource_filename(
                            "annotald","data/html/logs.mako"),
                            strict_undefined = True)

    plots = []
    
    if formData:
        for k in allPlots.keys():
            print k
            try:
                plot = allPlots[k](evtlog, **formData)
                plots.append(formatPlot(k, plot))
            except PlotError as e:
                plots.append(formatPlotError(e))

    try:
        startdate = formData['startdate']
    except KeyError:
        startdate = time.strftime("%Y-%m-%d", time.gmtime())

    try:
        enddate = formData['enddate']
    except KeyError:
        enddate = time.strftime("%Y-%m-%d", time.gmtime())

    return plotTemplate.render(plottypes = allPlots.keys(),
                               startdate = startdate,
                               enddate = enddate,
                               plots = plots)
    
