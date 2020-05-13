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

    /*The graphicals elements in the chartArea*/
    let charts = [];
    let upperLines = [];

    /*Some actual states about the graph*/
    //so we can ask the model for the maxY to display in the UI
    let displayedXInterval = null;
    let categorySelected = 0;

    //----------------------------------------SOME DISPLAYED PREFERENCES ABOUT THE GRAPH -------------------------------------------
    let seeChartInterleaving = false;
    let isStreamChart = false;

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
        setChartInterleavingValue(!seeChartInterleaving)
      }

      if (char == "t") {
        setStreamGraphValue(!isStreamChart)
      }

      if (char == "f") {
        isTimeFrozen = !isTimeFrozen;
      }
      if (Number(char) && data != null && Number(char)<=data.categories.length){
        selectACategory(Number(char))
      }
    });

    //-------------------------------------------------INITIAL FLOW --------------------------------------------

    //load the csv file init the graph
    d3.csv("assets/data/weekly_score.csv", function (d) {
      data = model.prepareData(d);
      displayedXInterval = [data.smallestDate, data.biggestDate]

      UI.setData({
        data: data,
        maxYscore: seeChartInterleaving ?  data.maxSingleScore : data.maxScoreAtTimeStamp,
        onBrush: userBrushed,
      });

      UI.prepareElements();
      addElementsToStackedArea(data);

      setChartInterleavingValue(seeChartInterleaving)
      setStreamGraphValue(isStreamChart)
    });

    function addElementsToStackedArea(data) {
      //initiate the charts
      charts = [];
      for (let i = 0; i < data.categories.length; i++) {
        charts.push(
          UI.createChart({
            data: data,
            id: i,
            stacksSupperpose: !seeChartInterleaving,
            streamChartWhenSupperPosed: isStreamChart,
            scaleSelected: categorySelected,
          })
        )
      }

      //initiate the lines
      upperLines = [];
      if (seeChartInterleaving) {
        for (let i = 0; i < data.categories.length; i++) {
          upperLines.push(
            UI.createUpperLine({
              data: data,
              id: i,
              stacksSupperpose: !seeChartInterleaving,
              scaleSelected: categorySelected == 0 ? null : categorySelected-1,
            })
          );
        }
      }

      //clean the previous charts and lines
      UI.removeCharts();
      UI.removeLines();
      UI.removePartsOfChart();
      UI.removeFrontCharts();
      UI.updateTitles(-1,-1);

      let chartInOrder = getChartInOrder(charts);

      if(seeChartInterleaving) {
        UI.renderCharts(chartInOrder, false);
        UI.renderUpperLines(upperLines);
        heavyCompute();
        UI.renderUpperLines(upperLines);
      } else {
        UI.renderCharts(chartInOrder, true);
      }
    } //end of create plot function


    //-------------------------------------------------PLOT CHANGES --------------------------------------------


    function setChartInterleavingValue(value){
      seeChartInterleaving = value
      interLeavingCheckBox.checked = seeChartInterleaving
      if (seeChartInterleaving) {
        streamGraphXbSpan.style.display = "none"
      } else {
        streamGraphXbSpan.style.display = "inline"
      }
    }

    function setStreamGraphValue(value){
      isStreamChart = value
      streamGraphCheckBox.checked = isStreamChart

      if(!seeChartInterleaving){
        addElementsToStackedArea(data);
        if(categorySelected != 0){
          //yAxisSelectorChanged(scaleSelected);
        }
      }
    }

    function selectACategory(id){
      categorySelected = categorySelected == id+1 ? 0 : id+1
      if(categorySelected==0){
        UI.updateTitles(id,-1)
      }else{
        UI.updateTitles(-1,id)
      }

      console.log(categorySelected)
      /*if(catId == null){
      categorySelected = 0
    }else{
    categorySelected = catId + 1
  }

  let value = 0
  if (catId != null){
  value = catId + 1
}
//yAxisSelectorChanged(value);
console.log(value);

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
//console.log("User just selected the category" + catId)*/
}






















function setStackSupperposed(newValue) {
  /*stacksSupperpose = newValue;

  interLeavingCheckBox.checked = !newValue;

  let maxYScore = stacksSupperpose
  ? data.maxScoreAtTimeStamp
  : data.maxSingleScore;
  UI.setData({
  data: data,
  maxYscore: maxYScore,
  onBrush: userBrushed,
});
UI.drawYAxis();

adaptYScale(displayedXInterval);

addElementsToStackedArea(data);*/
}

function shouldAdaptYScale(shouldAdapt) {
  freezeYCheckBox.checked = !shouldAdapt;
  adaptYScale(displayedXInterval);
  if (!stacksSupperpose) {
    heavyCompute();
    UI.renderUpperLines(upperLines);
  }

}

function yAxisSelectorChanged(newValue) {
  scaleSelected = newValue;
  shouldAdaptYScale(true);
  addElementsToStackedArea(data);
  //console.log(newValue)
  //yAxisSelector.style.backgroundColor = newValue == 0 ? "#B1B1B1" : UI.colorForFadingIndex(newValue-1)
  //yAxisSelector.style.color = newValue == 0 ? "black" : "#B1B1B1"
}









function getChartInOrder(charts) {
  if (categorySelected == 0) {
    //normal order
    return charts;
  }
  let ordered = [];
  ordered.push(charts[categorySelected - 1]);
  charts.forEach((c) => {
    if (c.id != categorySelected - 1) {
      ordered.push(c);
    }
  });
  return ordered;
}

function adaptYScale(forInterval) {
  /*let scaleToUse = scaleSelected;
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
}*/

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







//-------------------------------------------------METHOD CALLED FROM THE UI --------------------------------------------

function mouseClickedInTitle(id){
  UI.addFrontCharts(id, charts);
  selectACategory(id)
}

function clickInFrontChart(id){
  UI.addFrontCharts(id, charts);
  selectACategory(id)
}

function mouseOverTitle(id) {
  //console.log("Mouse over title " + data.categories[id])
  if (categorySelected == 0) {
    UI.addFrontCharts(id, charts);
    UI.hideFrameContainer();
    UI.removeLines();
    UI.updateTitles(id,-1)
  }
}

function mouseLeftTitle(id) {
  //console.log("Mouse left title " + data.categories[id])
  if (categorySelected == 0) {
    UI.removeFrontCharts();
    UI.showFrameContainer();
    UI.renderUpperLines(upperLines);
    UI.updateTitles(-1,-1)
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

  window.clearInterval(timerBeforeComputingChartInterleaving);
  UI.removePartsOfChart();
  if (seeChartInterleaving) {
    UI.removePartsOfChart();
    //UI.removeLines()
    for (var i = 0; i < upperLines.length; i++) {
      upperLines[i].showOnly(b);
    }
    timerBeforeComputingChartInterleaving = window.setTimeout(function () {
      heavyCompute();
      UI.renderUpperLines(upperLines);
      if (categorySelected != null) {
        UI.addFrontCharts(categorySelected, charts);
      }
    }, 250);
  }
  //addPartsOfChart()
}

function mouseInChart(chartId) {
  //console.log("Mouse went inside chart "+ chartId)
  if (isTimeFrozen) return;
  if (categorySelected == 0 && !seeChartInterleaving) {
    UI.addFrontCharts(chartId, charts);
    UI.updateTitles(chartId, -1)
  }
}
function mouseMoveOutOfCharts(atDate) {
  if (isTimeFrozen) return;
  //console.log("Mouse move out of the charts at Date"+atDate)
  if (categorySelected == 0) {
    UI.removeFrontCharts();
    UI.updateTitles(-1, -1)
  }
  updateVerticalLineInUI(atDate.getTime())
}

function mouseMoveInFrontChart(chartId, atDate) {
  if (isTimeFrozen) return;
  updateVerticalLineInUI(atDate.getTime())
}

function updateVerticalLineInUI(timestamp){
  /*let color =
  categorySelected == null
  ? "#B1B1B1"
  : UI.colorForIndex(categorySelected);
  let closestIndex = model.getClosestIndex(new Date(timestamp), data);
  UI.addVerticalLines(
  [timestamp],
  color,
  data.values[closestIndex].date
);
*/
}

function mouseClickedInPartOfChart(chartId) {
  /*userSelectedCategory(chartId);
  UI.hideFrameContainer();
  UI.removeLines();*/
}



return {
  mouseClickedInTitle:mouseClickedInTitle,
  mouseOverTitle: mouseOverTitle,
  mouseLeftTitle: mouseLeftTitle,

  mouseInChart: mouseInChart,
  mouseMoveInFrontChart: mouseMoveInFrontChart,
  mouseMoveOutOfCharts: mouseMoveOutOfCharts,
  mouseClickedInPartOfChart: mouseClickedInPartOfChart,
  updateVerticalLineInUI:updateVerticalLineInUI,
  clickInFrontChart:clickInFrontChart,
};
})();
App.Plot1 = Plot1;
window.App = App;
})(window);
