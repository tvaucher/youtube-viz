(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1 = (function () {
    const model = App.Plot1DataModel;
    const UI = App.Plot1UI;

    var heavyComputationTimer = null;

    //the charts that will be displayed
    let charts = [];
    let upperLines = [];
    let maxYScore = null;
    let displayedXInterval = null;

    let stacksSupperpose = true;
    let streamChartWhenSupperPosed = true;
    let stackClever = true;
    let adapativeYScale = true;

    let data = null;
    let categorySelected = null;

    let interLeavingCheckBox = document.getElementById("interLeavingXb");
    let freezeYCheckBox = document.getElementById("freezeYAxis");
    let streamGraphXbSpan = document.getElementById("streamGraphXbSpan");
    let streamGraphCheckBox = document.getElementById("streamGraphXb");
    //define the position of the rect that will contain the stacked graphs

    //load the csv file and call addElementsToStackedArea(),createSlider() when done
    //d3.csv("/data/plot1data2.csv",function(d) {
    d3.csv("assets/data/video_count/count_week.csv", function (d) {
      data = model.prepareData(d);
      maxYScore = stacksSupperpose
        ? data.maxScoreAtTimeStamp
        : data.maxSingleScore;
      displayedXInterval = [data.smallestDate, data.biggestDate];
      UI.setData({
        data: data,
        maxYscore: maxYScore,
        onBrush: userBrushed,
      });
      UI.prepareElements();
      addElementsToStackedArea(data);
    });

    interLeavingCheckBox.addEventListener("change", function (e) {
      setStackSupperposed(!e.target.checked);
    });

    freezeYCheckBox.addEventListener("change", function (e) {
      adapatYScale(!e.target.checked);
    });

    streamGraphCheckBox.addEventListener("change", function (e) {
      setSteamGraph(e.target.checked);
    });

    function setStackSupperposed(newValue) {
      stacksSupperpose = newValue;
      if (!stacksSupperpose) {
        streamGraphXbSpan.style.display = "none";
      } else {
        streamGraphXbSpan.style.display = "inline";
      }
      interLeavingCheckBox.checked = !newValue;
      maxYScore = stacksSupperpose
        ? data.maxScoreAtTimeStamp
        : data.maxSingleScore;
      UI.setData({
        data: data,
        maxYscore: maxYScore,
        onBrush: userBrushed,
      });
      UI.drawYAxis();

      if (adapativeYScale) {
        adaptYScale(displayedXInterval);
      }
      addElementsToStackedArea(data);
    }

    function adapatYScale(shouldAdapt) {
      adapativeYScale = shouldAdapt;
      freezeYCheckBox.checked = !shouldAdapt;
      if (adapativeYScale) {
        adaptYScale(displayedXInterval);
        if (!stacksSupperpose) {
          heavyCompute();
          UI.renderUpperLines(upperLines);
        }
      }
    }

    function setSteamGraph(futureValue) {
      streamChartWhenSupperPosed = futureValue;
      streamGraphCheckBox.checked = streamChartWhenSupperPosed;
      if (stacksSupperpose) {
        addElementsToStackedArea(data);
      }
    }

    document.addEventListener("keypress", function (e) {
      const char = String.fromCharCode(e.charCode);
      if (char == "s") {
        setStackSupperposed(!stacksSupperpose);
      }

      if (char == "y") {
        adapatYScale(!adapativeYScale);
      }

      if (char == "t") {
        setSteamGraph(!streamChartWhenSupperPosed);
      }
    });

    function addElementsToStackedArea(data) {
      //draw the complete charts
      charts = [];
      for (let i = 0; i < data.categories.length; i++) {
        charts.push(
          UI.createChart({
            data: data,
            id: i,
            stacksSupperpose: stacksSupperpose,
            streamChartWhenSupperPosed: streamChartWhenSupperPosed,
          })
        );
      }

      upperLines = [];
      if (!stacksSupperpose) {
        for (let i = 0; i < data.categories.length; i++) {
          upperLines.push(
            UI.createUpperLine({
              data: data,
              id: i,
              stacksSupperpose: stacksSupperpose,
            })
          );
        }
      }

      UI.removeCharts();
      UI.removeLines();
      UI.removePartsOfChart();
      UI.removeFrontCharts();
      UI.setCategorySelectedToNull();
      categorySelected = null;
      UI.makeTitlesLookNormal();

      if (stacksSupperpose) {
        UI.renderCharts(charts, true);
      } else {
        UI.renderCharts(charts, false);
        if (stackClever) {
          UI.renderUpperLines(upperLines);
          heavyCompute();
          UI.renderUpperLines(upperLines);
        }
        //
      }
    } //end of create plot function

    function adaptYScale(forInterval) {
      if (adapativeYScale) {
        var bounds = model.getMaxValuesBetween(
          data,
          forInterval[0],
          forInterval[1]
        );
        var maxBound = stacksSupperpose
          ? bounds.maxScoreAtTimeStamp
          : bounds.maxSingleScore;
        UI.setData({
          data: data,
          maxYscore: maxBound,
          onBrush: userBrushed,
        });
        UI.drawYAxis();

        for (var i = 0; i < charts.length; i++) {
          charts[i].rescaleY(maxBound);
        }
        for (var i = 0; i < upperLines.length; i++) {
          upperLines[i].rescaleY(maxBound);
        }
      }
    }

    function userBrushed(b) {
      displayedXInterval = b;
      UI.getXscale().domain(b);
      adaptYScale(b);

      for (var i = 0; i < charts.length; i++) {
        charts[i].showOnly(b);
      }
      for (var i = 0; i < upperLines.length; i++) {
        upperLines[i].showOnly(b);
      }

      window.clearInterval(heavyComputationTimer);
      UI.removePartsOfChart();
      if (!stacksSupperpose && stackClever) {
        UI.removePartsOfChart();
        //UI.removeLines()
        for (var i = 0; i < upperLines.length; i++) {
          upperLines[i].showOnly(b);
        }
        heavyComputationTimer = window.setTimeout(function () {
          heavyCompute();
          UI.renderUpperLines(upperLines);
          if (categorySelected != null) {
            UI.addFrontCharts(categorySelected, charts);
          }
        }, 250);
      }
      //addPartsOfChart()
    }

    function heavyCompute() {
      let orderTimeStamps = model.computeTimeStampsBreaks(
        upperLines,
        data,
        UI.getXscale(),
        displayedXInterval
      );
      let chartInterLeaving = model.computeChartInterLeaving(orderTimeStamps);
      UI.addPartsOfChart(
        data.smallestDate.getTime(),
        chartInterLeaving,
        stacksSupperpose,
        data
      );
    }

    function mouseOverTitle(id) {
      if (categorySelected == null) {
        //console.log("Mouse over title " + data.categories[id])
        UI.addFrontCharts(id, charts);
        UI.hideFrameContainer();
        UI.removeLines();
      }
    }

    function mouseLeftTitle(id) {
      if (categorySelected == null) {
        //console.log("Mouse left title " + data.categories[id])
        UI.removeFrontCharts();
        UI.showFrameContainer();
        UI.renderUpperLines(upperLines);
      }
    }

    function userSelectedCategory(catId) {
      categorySelected = catId;
      if (catId == null) {
        UI.makeTitlesLookNormal();
        if (!stacksSupperpose) {
          UI.removeFrontCharts();
          UI.showFrameContainer();
          UI.renderUpperLines(upperLines);
        }
      } else {
        UI.addFrontCharts(catId, charts);
        UI.updateTitles(catId, catId);
      }

      //console.log("User just selected the category" + catId)
    }

    function mouseInChart(chartId) {
      if (categorySelected == null) {
        //console.log("Mouse went inside chart "+ chartId)
        UI.addFrontCharts(chartId, charts);
      }
    }
    function mouseMoveOutOfCharts(atDate) {
      //console.log("Mouse move out of the charts at Date"+atDate)
      if (categorySelected == null) {
        UI.removeFrontCharts();
        UI.makeTitlesLookNormal();
      }
      let color =
        categorySelected == null
          ? "#B1B1B1"
          : UI.colorForIndex(categorySelected);
      let closestIndex = model.getClosestIndex(atDate, data);
      UI.addVerticalLines(
        [atDate.getTime()],
        color,
        data.values[closestIndex].date
      );
      console.log(
        "Should display info for date " +
          atDate +
          " and category " +
          categorySelected
      );
    }

    function mouseMoveInFrontChart(chartId, atDate) {
      //  UI.colorForIndex(chartId)
      let color =
        categorySelected == null
          ? "#B1B1B1"
          : UI.colorForIndex(categorySelected);
      let closestIndex = model.getClosestIndex(atDate, data);
      UI.addVerticalLines(
        [atDate.getTime()],
        color,
        data.values[closestIndex].date
      );
      console.log(
        "Should display info for date " +
          atDate +
          " and category " +
          categorySelected
      );
    }

    function mouseClickedInPartOfChart(chartId) {
      userSelectedCategory(chartId);
      UI.hideFrameContainer();
      UI.removeLines();
      //console.log("Mouse move in Part Of chart "+ chartId + " for the date " + atDate)
    }

    return {
      mouseOverTitle: mouseOverTitle,
      mouseLeftTitle: mouseLeftTitle,
      mouseInChart: mouseInChart,
      mouseMoveInFrontChart: mouseMoveInFrontChart,
      mouseMoveOutOfCharts: mouseMoveOutOfCharts,
      userSelectedCategory: userSelectedCategory,
      mouseClickedInPartOfChart: mouseClickedInPartOfChart,
    };
  })();
  App.Plot1 = Plot1;
  window.App = App;
})(window);
