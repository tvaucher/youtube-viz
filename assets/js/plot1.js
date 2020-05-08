(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1 = (function () {
    const model = App.Plot1DataModel;
    const UI = App.Plot1UI;

    /*When this timer fires, it compute the chart interleaving order*/
    var heavyComputationTimer = null;
    let isTimeFrozen = false;

    //the data from the csv file
    let data = null;

    /*The graphicals elements in the chartArea*/
    let charts = [];
    let upperLines = [];

    /*Some actual states about the graph*/
    let maxYScore = null;
    let displayedXInterval = null;
    let categorySelected = null;
    let scaleSelected = 0;

    //-------------SOME DISPLAYED PREFERENCES ABOUT THE GRAPH --------------------------------------------
    let stacksSupperpose = true;
    let streamChartWhenSupperPosed = true;
    let adapativeYScale = true;

    //the user controls
    let interLeavingCheckBox = document.getElementById("interLeavingXb");
    let freezeYCheckBox = document.getElementById("freezeYAxis");
    let streamGraphXbSpan = document.getElementById("streamGraphXbSpan");
    let streamGraphCheckBox = document.getElementById("streamGraphXb");

    let yAxisSelector = document.getElementById("yAxisSelector");
    let yAxisBox = document.getElementById("yAxisSelectorWrapper");

    //the related event listeners
    interLeavingCheckBox.addEventListener("change", function (e) {
      setStackSupperposed(!e.target.checked);
    });

    freezeYCheckBox.addEventListener("change", function (e) {
      shouldAdaptYScale(!e.target.checked);
    });

    streamGraphCheckBox.addEventListener("change", function (e) {
      setSteamGraph(e.target.checked);
    });

    yAxisSelector.addEventListener("change", function (e) {
      yAxisSelectorChanged(e.target.value);
    });

    //the keyboard shortcuts for theses functions
    document.addEventListener("keypress", function (e) {
      const char = String.fromCharCode(e.charCode);
      if (char == "s") {
        setStackSupperposed(!stacksSupperpose);
      }

      if (char == "y") {
        shouldAdaptYScale(!adapativeYScale);
      }

      if (char == "t") {
        setSteamGraph(!streamChartWhenSupperPosed);
      }

      if (char == "f") {
        isTimeFrozen = !isTimeFrozen;
      }
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
      isSelectBoxHidden(stacksSupperpose && streamChartWhenSupperPosed);
    }

    function shouldAdaptYScale(shouldAdapt) {
      adapativeYScale = shouldAdapt;
      freezeYCheckBox.checked = !shouldAdapt;
      if (adapativeYScale) {
        adaptYScale(displayedXInterval);
        if (!stacksSupperpose) {
          heavyCompute();
          UI.renderUpperLines(upperLines);
        }
      }
      isSelectBoxHidden(stacksSupperpose && streamChartWhenSupperPosed);
    }

    function setSteamGraph(futureValue) {
      streamChartWhenSupperPosed = futureValue;
      streamGraphCheckBox.checked = streamChartWhenSupperPosed;
      if (stacksSupperpose) {
        addElementsToStackedArea(data);
        if (scaleSelected != 0) {
          yAxisSelectorChanged(scaleSelected);
        }
      }
      isSelectBoxHidden(stacksSupperpose && streamChartWhenSupperPosed);
    }

    function yAxisSelectorChanged(newValue) {
      scaleSelected = newValue;
      shouldAdaptYScale(adapativeYScale);
      addElementsToStackedArea(data);
      //console.log(newValue)
      //yAxisSelector.style.backgroundColor = newValue == 0 ? "#B1B1B1" : UI.colorForFadingIndex(newValue-1)
      //yAxisSelector.style.color = newValue == 0 ? "black" : "#B1B1B1"
    }

    function isSelectBoxHidden(bool) {
      yAxisBox.style.visibility = bool ? "hidden" : "visible";
    }

    //load the csv file and call addElementsToStackedArea(),createSlider() when done
    d3.csv("assets/data/score/score_week.csv", function (d) {
      data = model.prepareData(d);
      prepareYAxisSelector(data);
      maxYScore = stacksSupperpose
        ? data.maxScoreAtTimeStamp
        : data.maxSingleScore;
      displayedXInterval = [data.smallestDate, data.biggestDate];

      let selectBoxHidden = false;
      if (stacksSupperpose && streamChartWhenSupperPosed) {
        selectBoxHidden = true;
      }
      isSelectBoxHidden(selectBoxHidden);

      UI.setData({
        data: data,
        maxYscore: maxYScore,
        onBrush: userBrushed,
      });
      UI.prepareElements();
      addElementsToStackedArea(data);
    });

    function prepareYAxisSelector(data) {
      yAxisSelector.innerHTML = "";
      let defautOption = document.createElement("option");
      defautOption.value = "0";
      defautOption.textContent = "All";
      defautOption.style.backgroundColor = "#B1B1B1";
      yAxisSelector.appendChild(defautOption);
      data.categories.forEach((c, i) => {
        let newOption = document.createElement("option");
        newOption.value = i + 1;
        newOption.textContent = c;
        let backGroundColor = UI.colorForFadingIndex(i + 1);
        let color = UI.colorForIndex(i + 1);
        //newOption.style.backgroundColor = backGroundColor
        //newOption.style.color = color
        yAxisSelector.appendChild(newOption);
      });
    }

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
            scaleSelected: scaleSelected,
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
              scaleSelected: scaleSelected,
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

      let chartInOrder = getChartInOrder(charts);

      if (stacksSupperpose) {
        UI.renderCharts(chartInOrder, true);
      } else {
        UI.renderCharts(chartInOrder, false);
        UI.renderUpperLines(upperLines);
        heavyCompute();
        UI.renderUpperLines(upperLines);
      }
    } //end of create plot function

    function getChartInOrder(charts) {
      if (scaleSelected == 0) {
        return charts;
      }
      let ordered = [];
      ordered.push(charts[scaleSelected - 1]);
      charts.forEach((c) => {
        if (c.id != scaleSelected - 1) {
          ordered.push(c);
        }
      });
      return ordered;
    }

    function adaptYScale(forInterval) {
      if (adapativeYScale) {
        let scaleToUse = scaleSelected;
        if (stacksSupperpose && streamChartWhenSupperPosed) {
          scaleToUse = 0;
        }
        var bounds = model.getMaxValuesBetween(
          data,
          forInterval[0],
          forInterval[1],
          scaleToUse
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
      if (!stacksSupperpose) {
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
      if (isTimeFrozen) return;
      if (categorySelected == null && stacksSupperpose) {
        //console.log("Mouse went inside chart "+ chartId)
        UI.addFrontCharts(chartId, charts);
      }
    }
    function mouseMoveOutOfCharts(atDate) {
      if (isTimeFrozen) return;
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
      /*console.log(
        "Should display info for date " +
          atDate +
          " and category " +
          categorySelected
      );*/
    }

    function mouseMoveInFrontChart(chartId, atDate) {
      //  UI.colorForIndex(chartId)
      if (isTimeFrozen) return;
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
      /* console.log(
        "Should display info for date " +
          atDate +
          " and category " +
          categorySelected
      ); */
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
