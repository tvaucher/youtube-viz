(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1 = (function () {
    const model = App.Plot1DataModel;
    const UI = App.Plot1UI;

    /*When this timer fires, it compute the chart interleaving order*/
    var timerBeforeComputingChartInterleaving = null;
    let isTimeFrozen = false;

    //the data from the csv file
    let data = null;
    //the order in the one to draw the data
    let dataOrder = [];
    let displayedOrder = [];

    /*The graphicals elements in the chartArea*/
    let charts = [];
    let upperLines = [];

    /*Some actual states about the graph*/
    //so we can ask the model for the maxY to display in the UI
    let displayedXInterval = null;
    let categorySelected = 0;

    let videoTableIntervalDisplay = true;


    //----------------------------------------SOME DISPLAYED PREFERENCES ABOUT THE GRAPH -------------------------------------------
    let seeChartInterleaving = false;
    let isStreamChart = true;

    let settingVisible = false

    //the user controls
    let interLeavingCheckBox = document.getElementById("interLeavingXb");
    let streamGraphXbSpan = document.getElementById("streamGraphXbSpan");
    let streamGraphCheckBox = document.getElementById("streamGraphXb");

    //the related event listeners
    interLeavingCheckBox.addEventListener("change", function (e) {
      setChartInterleavingValue(e.target.checked);
    });

    streamGraphCheckBox.addEventListener("change", function (e) {
      setStreamGraphValue(e.target.checked);
    });

    //the keyboard shortcuts for theses functions
    document.addEventListener("keypress", function (e) {
      const char = String.fromCharCode(e.charCode);
      if (char == "s") {
        setChartInterleavingValue(!seeChartInterleaving);
      }

      if (char == "t") {
        setStreamGraphValue(!isStreamChart);
      }

      if (char == "f") {
        isTimeFrozen = !isTimeFrozen;
      }
      if (
        Number(char) &&
        data != null &&
        Number(char) <= data.categories.length
      ) {
        selectACategory(Number(char));
      }
    });

    document.getElementById("toggle-on").addEventListener("change", () => {
      videoTableIntervalDisplay = true;
      App.Table.filterDateRange(displayedXInterval);
      App.HelperPlot.filterDateRange(displayedXInterval);
    });

    document
    .getElementById("toggle-off")
    .addEventListener("change", () => (videoTableIntervalDisplay = false));

    document.getElementById("settingButton").addEventListener("click", function(){
      settingVisible = !settingVisible
      document.getElementById("plot1CheckBoxes").style.display = settingVisible ? "flex" : "none"
    });



    //-------------------------------------------------INITIAL FLOW --------------------------------------------

    //load the csv file init the graph
    d3.csv("assets/data/weekly_score.csv", function (d) {
      data = model.prepareData(d);
      for (let i = 0; i < data.categories.length; i++) {
        dataOrder.push(i);
      }
      displayedOrder = dataOrder;
      displayedXInterval = [data.smallestDate, data.biggestDate];

      UI.setData({
        data: data,
        maxYscore: seeChartInterleaving
        ? data.maxSingleScore
        : data.maxScoreAtTimeStamp,
        onBrush: userBrushed,
      });

      UI.prepareElements();
      addElementsToStackedArea(data);

      setChartInterleavingValue(seeChartInterleaving);
      setStreamGraphValue(isStreamChart);
      UI.setZoomOutButtonVisible(false);

      window.addEventListener("resize", onResize)
    });

    function addElementsToStackedArea() {
      if (seeChartInterleaving || !isStreamChart) {
        changeDataOrder();
        displayedOrder = dataOrder;
      }

      //initiate the charts
      charts = [];
      for (let i = 0; i < data.categories.length; i++) {
        charts.push(
          UI.createChart({
            data: data,
            dataOrder: displayedOrder,
            id: i,
            stacksSupperpose: !seeChartInterleaving,
            streamChartWhenSupperPosed: isStreamChart,
          })
        );
      }

      //initiate the lines
      upperLines = [];
      if (seeChartInterleaving) {
        for (let i = 0; i < data.categories.length; i++) {
          upperLines.push(
            UI.createUpperLine({
              data: data,
              dataOrder: displayedOrder,
              id: i,
              stacksSupperpose: !seeChartInterleaving,
            })
          );
        }
      }

      //clean the previous charts and lines
      UI.removeCharts();
      UI.removeLines();
      UI.removePartsOfChart();
      UI.removeFrontCharts();
      UI.updateTitles(-1, -1);

      if (seeChartInterleaving) {
        UI.renderCharts(charts, false);
        UI.renderUpperLines(upperLines);
        if (categorySelected == 0) {
          heavyCompute();
          UI.renderUpperLines(upperLines);
        }
      } else {
        UI.renderCharts(charts, true);
      }


    } //end of create plot function

    function onResize(){
      console.log(data)
      UI.prepareElements()
      addElementsToStackedArea()
      setChartInterleavingValue(seeChartInterleaving);
      setStreamGraphValue(isStreamChart);
    }

    //-------------------------------------------------PLOT CHANGES --------------------------------------------

    function setChartInterleavingValue(value) {
      seeChartInterleaving = value;
      interLeavingCheckBox.checked = seeChartInterleaving;
      if (seeChartInterleaving) {
        streamGraphXbSpan.style.display = "none";
      } else {
        streamGraphXbSpan.style.display = "inline";
      }
      adaptYScale();
      addElementsToStackedArea(data);
      if (categorySelected != 0) {
        let cat = categorySelected;
        categorySelected = 0;
        selectACategory(cat);
      }
    }

    function setStreamGraphValue(value) {
      isStreamChart = value;
      streamGraphCheckBox.checked = isStreamChart;

      if (!seeChartInterleaving) {
        //visible changes
        addElementsToStackedArea(data);
        if (categorySelected != 0) {
          adaptYScale();
          UI.addFrontCharts(categorySelected - 1, charts);
          UI.updateTitles(-1, categorySelected - 1);
        }
      }
    }

    function selectACategory(id) {
      if (id == categorySelected) {
        categorySelected = 0;
      } else {
        categorySelected = id;
      }
      App.Table.filterCategory(
        categorySelected === 0 ? null : categorySelected - 1
      );
      App.HelperPlot.filterCategory(
        categorySelected === 0 ? null : categorySelected - 1
      );

      if (seeChartInterleaving || !isStreamChart) {
        changeDataOrder();
      }
      adaptYScale();
      let color =
      categorySelected == 0
      ? "#B1B1B1"
      : UI.colorForIndex(categorySelected - 1);
      UI.updateColor(color);
      addElementsToStackedArea(data);

      if (categorySelected == 0) {
        //no category
        UI.updateTitles(id - 1, -1);
        if (id > 0) {
          UI.addFrontCharts(id - 1, charts);
        }
      } else {
        UI.addFrontCharts(id - 1, charts);
        UI.updateTitles(-1, id - 1);
      }

      //finally, we must update the y-axis

      //console.log("User just selected the category" + catId)*/
    }

    function adaptYScale() {
      let scaleToUse = categorySelected;
      if ((isStreamChart && !seeChartInterleaving) || seeChartInterleaving) {
        scaleToUse = 0;
      }

      var bounds = model.getMaxValuesBetween(
        data,
        displayedXInterval[0],
        displayedXInterval[1],
        scaleToUse
      );

      var maxBound = !seeChartInterleaving
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
        !seeChartInterleaving,
        data
      );
    }

    function userBrushed(b) {
      displayedXInterval = b;
      if (videoTableIntervalDisplay) {
        App.HelperPlot.filterDateRange(b);
        App.Table.filterDateRange(b);
      }

      if (
        b[0].getTime() == data.smallestDate.getTime() &&
        b[1].getTime() == data.biggestDate.getTime()
      ) {
        UI.setZoomOutButtonVisible(false);
      } else {
        UI.setZoomOutButtonVisible(true);
      }
      adaptYScale();

      for (var i = 0; i < charts.length; i++) {
        charts[i].showOnly(b);
      }
      for (var i = 0; i < upperLines.length; i++) {
        upperLines[i].showOnly(b);
      }

      window.clearInterval(timerBeforeComputingChartInterleaving);
      if (seeChartInterleaving) {
        UI.removePartsOfChart();
        for (var i = 0; i < upperLines.length; i++) {
          upperLines[i].showOnly(b);
        }
        timerBeforeComputingChartInterleaving = window.setTimeout(function () {
          if (categorySelected == 0) {
            heavyCompute();
            UI.renderUpperLines(upperLines);
          } else {
            UI.addFrontCharts(categorySelected - 1, charts);
          }
        }, 250);
      }
      //addPartsOfChart()
    }
    //-------------------------------------------------METHOD CALLED FROM THE UI --------------------------------------------

    function mouseClickedInTitle(id) {
      //console.log("mouseClickedInTitle " +id)
      selectACategory(id + 1);
    }

    function clickInFrontChart(id) {
      //console.log("clickInFrontChart " +id)
      selectACategory(id + 1);
      if (categorySelected == 0) {
        UI.removeFrontCharts();
      }
    }

    function mouseOverTitle(id) {
      //console.log("Mouse over title " + data.categories[id])
      if (categorySelected == 0) {
        if (!isTimeFrozen) updateVerticalLineInUI(null);
        UI.addFrontCharts(id, charts);
        UI.hideFrameContainer();
        UI.removeLines();
        UI.updateTitles(id, -1);
      }
    }

    function mouseLeftTitle(id) {
      //console.log("Mouse left title " + data.categories[id])
      if (categorySelected == 0) {
        UI.removeFrontCharts();
        UI.showFrameContainer();
        UI.renderUpperLines(upperLines);
        UI.updateTitles(-1, -1);
      }
    }

    function mouseInChart(chartId) {
      //console.log("Mouse went inside chart "+ chartId)
      if (isTimeFrozen) return;
      if (categorySelected == 0 && !seeChartInterleaving) {
        UI.addFrontCharts(chartId, charts);
      }

      if (categorySelected == 0) {
        UI.updateTitles(chartId, -1);
      }
    }

    function mouseInPartOfChart(chartId) {
      //console.log("mouseInPartOfChart "+chartId)
      mouseInChart(chartId);
    }

    function mouseMoveOutOfCharts(atDate) {
      if (isTimeFrozen) return;
      //console.log("Mouse move out of the charts at Date"+atDate)
      if (categorySelected == 0) {
        UI.removeFrontCharts();
        UI.updateTitles(-1, -1);
      }
      updateVerticalLineInUI(atDate.getTime());
      testIfRedrawTable(atDate);
    }

    function mouseMoveInFrontChart(chartId, atDate) {
      if (isTimeFrozen) return;
      //console.log("mouseMoveInFrontChart "+chartId)
      updateVerticalLineInUI(atDate.getTime());
      testIfRedrawTable(atDate);
    }

    function mouseMoveInPartOfChart(chartId, atDate) {
      if (isTimeFrozen) return;
      //console.log("mouseMoveInPartOfChart "+chartId)
      updateVerticalLineInUI(atDate.getTime());
      testIfRedrawTable(atDate);
    }

    function testIfRedrawTable(atDate) {
      if (!videoTableIntervalDisplay) {
        let current_date = dateFns.startOfWeek(atDate, { weekStartsOn: 1 });
        App.Table.filterDateRange(current_date);
        App.HelperPlot.filterDateRange(current_date);
      }
    }

    function updateVerticalLineInUI(timestamp) {
      let color =
      categorySelected == 0
      ? "#B1B1B1"
      : UI.colorForIndex(categorySelected - 1);
      let ts = timestamp == null ? [] : [timestamp];
      UI.addVerticalLines(
        ts,
        color,
        dateFns.startOfWeek(new Date(timestamp), { weekStartsOn: 1 })
      );
    }

    function changeDataOrder() {
      if (categorySelected == 0) {
        return;
      }
      let newOrder = [categorySelected - 1];
      dataOrder.forEach((o) => {
        if (o != categorySelected - 1) {
          newOrder.push(o);
        }
      });
      dataOrder = newOrder;
      console.log(dataOrder);
    }

    function mouseClickedInPartOfChart(chartId) {
      //console.log("mouseClickedInPartOfChart "+chartId)
      selectACategory(chartId + 1);
    }

    return {
      mouseClickedInTitle: mouseClickedInTitle,
      mouseOverTitle: mouseOverTitle,
      mouseLeftTitle: mouseLeftTitle,

      mouseInChart: mouseInChart,
      mouseInPartOfChart: mouseInPartOfChart,
      mouseMoveInPartOfChart: mouseMoveInPartOfChart,

      mouseMoveInFrontChart: mouseMoveInFrontChart,
      mouseMoveOutOfCharts: mouseMoveOutOfCharts,

      mouseClickedInPartOfChart: mouseClickedInPartOfChart,
      clickInFrontChart: clickInFrontChart,

      updateVerticalLineInUI: updateVerticalLineInUI,
    };
  })();
  App.Plot1 = Plot1;
  window.App = App;
})(window);
