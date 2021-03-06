(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1UI = (function () {
    const containerName = "plot1_container";
    const titleContainerId = "plot1_title_container";
    let titles = null;
    let svgWidth = document.getElementById(containerName).clientWidth;
    const svgHeight = document.getElementById(containerName).clientHeight;

    //-------------SOME UI PARAMTER TO TUNE-------------

    let minNumberOfPointInScreen = 4;
    let curveType = d3.curveLinear;

    //'curveMonotoneX','curveLinear','curveBasis', 'curveCardinal', 'curveStepBefore',...

    const stackedAreaMargin = {
      top: 15,
      left: 70,
      right: 40,
      height: 250,
    };

    const sliderBoxPreferences = {
      height: 20,
      tickHeight: 5,
      displayNiceAxis: false,
    };

    let stackedAreaMarginWidth =
    svgWidth - stackedAreaMargin.right - stackedAreaMargin.left;
    //------------------------------------------------
    let svg = null;
    let stackedArea = null;
    let stackedAreaBorderLines = null;
    let timeIntervalSelected = null
    let chartsContainer = null;
    let frontChartsPaths = null;
    let lastIndexHighlighted = null;

    let partOfChartContainer = null;
    let sliderBox = null;
    let bbrush = null;
    let brushXScale = null;
    let toCallForBrush = null;
    let zoomOutButton = d3.select("#zoomOutButton")

    // For the other plots
    let isTimeFrozen = false;


    document.addEventListener("keypress", function (e) {
      const char = String.fromCharCode(e.charCode);
      if (char == "f") {
        isTimeFrozen = !isTimeFrozen;
      }
    });


    zoomOutButton.on("click", function (e) {
      timeIntervalSelected = [smallestDate, biggestDate];
      onBrush()
      positionBrush(null, null);
    })
    /*.on("mousemove", function (e) {
    let coordinateX = d3.mouse(this)[0];
    let dateSelected = getXscale().invert(coordinateX);
    App.Plot1.updateVerticalLineInUI(dateSelected.getTime())
  });*/

  //the revelant data needed
  let smallestDate = null;
  let biggestDate = null;
  let maxYscore = null;
  let onBrush = null;
  let data = null;

  function setData(args) {
    data = args.data;
    smallestDate = args.data.smallestDate;
    biggestDate = args.data.biggestDate;
    maxYscore = args.maxYscore;
    onBrush = function () {
      drawXAxis();
      args.onBrush(timeIntervalSelected);
    };
  }

  function getMinTimeIntervalWeCanSee() {
    let timeIntervalBetweenDates =
    data.values[1].date.getTime() - data.values[0].date.getTime();
    let minActualNbOfPoint = Math.min(
      data.values.length,
      minNumberOfPointInScreen
    );
    return timeIntervalBetweenDates * (minActualNbOfPoint - 1);
  }

  //some mouse magic
  let isMouseDown = false;
  let mouseDownCoordinates = null;
  let rectTemporarilyDisappeared = false;

  function isMovingDown(toDate, clientY, clientX) {
    if (isMouseDown) {
      if (Math.abs(clientY - mouseDownCoordinates.y) < 40) {
        rectTemporarilyDisappeared = false;
        let fromDate =
        mouseDownCoordinates == null ? null : mouseDownCoordinates.fromDate;
        drawSelectionRect(fromDate, toDate, clientX);
      } else {
        rectTemporarilyDisappeared = true;
        removeSelectionRect(null);
        isMouseDown = true;
      }
    }
  }
  let xTolerance = 2;
  function removeSelectionRect(toDate, clientX) {
    if (toDate > biggestDate) {
      toDate = biggestDate;
    } else if (toDate < smallestDate) {
      toDate = smallestDate;
    }
    let shouldZoom =
    toDate != null &&
    isMouseDown &&
    !rectTemporarilyDisappeared &&
    Math.abs(clientX - mouseDownCoordinates.x) > xTolerance;
    isMouseDown = false;
    stackedArea.select("#aboveRectContainer").remove();
    if (shouldZoom) {
      let fromDate =
      mouseDownCoordinates == null ? null : mouseDownCoordinates.fromDate;
      let smD = fromDate < toDate ? fromDate : toDate;
      let biD = fromDate < toDate ? toDate : fromDate;
      let originalInterval = [smD, biD];

      let cleanedInterval = getCleanedInterval(originalInterval);
      let redWarning =
      cleanedInterval[0] != originalInterval[0] ||
      cleanedInterval[1] != originalInterval[1];
      timeIntervalSelected = redWarning
      ? [smallestDate, biggestDate]
      : cleanedInterval;
      if (redWarning) {
        positionBrush(null, null);
      } else {
        positionBrush(
          timeIntervalSelected[0],
          timeIntervalSelected[1]
        );
      }
    }
  }
  function drawSelectionRect(fromDate, toDate, clientX) {
    removeVerticalLines();
    removeSelectionRect(null);
    isMouseDown = true;

    if (Math.abs(clientX - mouseDownCoordinates.x) <= xTolerance) {
      return;
    }

    let x1 = getXscale()(fromDate);
    let x2 = getXscale()(toDate);
    let xLeft = x1 < x2 ? x1 : x2;
    let width = Math.abs(x1 - x2);
    let xRight = xLeft + width;

    let smD = fromDate < toDate ? fromDate : toDate;
    let biD = fromDate < toDate ? toDate : fromDate;
    let originalInterval = [smD, biD];

    let cleanedInterval = getCleanedInterval(originalInterval);
    let redWarning =
    cleanedInterval[0] != originalInterval[0] ||
    cleanedInterval[1] != originalInterval[1];

    let container = stackedArea.append("g").attr("id", "aboveRectContainer");

    let rect = container
    .append("rect")
    .attr("x", xLeft) //(mouseDownCoordinates.x - stackedAreaMargin.left))
    .attr("y", 0)
    .attr("width", width)
    .attr("height", stackedAreaMargin.height);
    if (redWarning) {
      rect.attr("class", "redWarning");
    }

    let line1 = container
    .append("line")
    .attr("x1", xLeft)
    .attr("y1", 0)
    .attr("x2", xLeft)
    .attr("y2", stackedAreaMargin.height);
    if (redWarning) {
      line1.attr("class", "redWarning");
    }

    let line2 = container
    .append("line")
    .attr("x1", xRight)
    .attr("y1", 0)
    .attr("x2", xRight)
    .attr("y2", stackedAreaMargin.height);
    if (redWarning) {
      line2.attr("class", "redWarning");
    }
  }

  function prepareSVGElement() {
    svgWidth = document.getElementById(containerName).clientWidth;
    stackedAreaMarginWidth = svgWidth - stackedAreaMargin.right - stackedAreaMargin.left;
    //delete the previous svg element
    d3.select("#plot1_container").select("svg").remove();



    //create a new svg element
    svg = d3
    .select("#plot1_container")
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight);

    svg.on("mouseup", function (e) {
      let coordinateX = d3.mouse(this)[0];
      let dateSelected = getXscale().invert(
        coordinateX - stackedAreaMargin.left
      );
      removeSelectionRect(dateSelected, d3.event.clientX);
    });

    svg.on("mousedown", function (e) {
      let coordinateX = d3.mouse(this)[0];
      let fromDate = getXscale().invert(coordinateX - stackedAreaMargin.left);
      if (fromDate < smallestDate) {
        fromDate = smallestDate;
      } else if (fromDate > biggestDate) {
        fromDate = biggestDate;
      }
      mouseDownCoordinates = {
        x: d3.event.clientX,
        y: d3.event.clientY,
        fromDate: fromDate,
      };
      isMouseDown = true;
    });

    svg
    .append("clipPath")
    .attr("id", "clipForStackedArea")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("height", stackedAreaMargin.height)
    .attr("width", stackedAreaMarginWidth);

    //add a container for the stacked area
    stackedArea = svg
    .append("g")
    .attr("class", "stackedArea")
    .attr(
      "transform",
      "translate(" +
      stackedAreaMargin.left +
      "," +
      stackedAreaMargin.top +
      ")"
    )
    .attr("clip-path", "url(#clipForStackedArea)");

    //add a container for the lines that will delimit the stacked area
    stackedAreaBorderLines = svg
    .append("g")
    .attr("class", "stackedAreaBorderLines")
    .attr(
      "transform",
      "translate(" +
      stackedAreaMargin.left +
      "," +
      stackedAreaMargin.top +
      ")"
    );

    //file the stackedAreaBorderLines with the 4 lines:
    //top
    stackedAreaBorderLines
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", stackedAreaMarginWidth)
    .attr("y2", 0)
    .attr("class", "stackedAreaBorder");
    //bottom
    stackedAreaBorderLines
    .append("line")
    .attr("x1", 0)
    .attr("y1", stackedAreaMargin.height)
    .attr("x2", stackedAreaMarginWidth)
    .attr("y2", stackedAreaMargin.height)
    .attr("class", "stackedAreaBorder");
    //left
    stackedAreaBorderLines
    .append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 0)
    .attr("y2", stackedAreaMargin.height)
    .attr("class", "stackedAreaBorder");
    //right
    stackedAreaBorderLines
    .append("line")
    .attr("x1", stackedAreaMarginWidth)
    .attr("y1", 0)
    .attr("x2", stackedAreaMarginWidth)
    .attr("y2", stackedAreaMargin.height)
    .attr("class", "stackedAreaBorder");
    //yAxisLabel
    svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 12)
    .attr("x", 0 - stackedAreaMargin.height / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .attr("class", "axisLabel")
    .text("Weekly Score per Category");

    svg.on("mousemove", function () {
      if (isTimeFrozen) return;
      let coordinateX = d3.mouse(this)[0];
      let coordinateY = d3.mouse(this)[1];
      let tolerancePixel = 30;
      if (
        coordinateX > stackedAreaMargin.left - tolerancePixel &&
        coordinateX <
        stackedAreaMargin.left + stackedAreaMarginWidth + tolerancePixel &&
        coordinateY > stackedAreaMargin.top - tolerancePixel &&
        coordinateY <
        stackedAreaMargin.top + stackedAreaMargin.height + tolerancePixel
      ) {
        let dateSelected = getXscale().invert(
          coordinateX - stackedAreaMargin.left
        );

        if (dateSelected < smallestDate) {
          dateSelected = smallestDate;
        } else if (dateSelected > biggestDate) {
          dateSelected = biggestDate;
        }

        isMovingDown(dateSelected, d3.event.clientY, d3.event.clientX);
        if (!isMouseDown) {
          App.Plot1.mouseMoveOutOfCharts(dateSelected);
        }
      } else {
        removeVerticalLines();
        removeSelectionRect(null);
      }
    });
  }

  function createTitles() {
    const titleContainer = document.getElementById(titleContainerId);
    titleContainer.innerHTML = "";
    titles = [];

    data.categories.forEach((cat, i) => {
      var title = document.createElement("div");
      title.innerHTML = cat;
      titleContainer.appendChild(title);
      title.style.color = colorForIndex(i);
      title.addEventListener("mouseover", function () {
        App.Plot1.mouseOverTitle(i);
      });
      title.addEventListener("mouseout", function () {
        App.Plot1.mouseLeftTitle(i);
      });

      title.addEventListener("click", function () {
        App.Plot1.mouseClickedInTitle(i);
      });
      titles.push(title);
    });
  }

  /*Create the slider box with the brush*/
  function createSlider() {
    timeIntervalSelected = [smallestDate, biggestDate];

    let sliderWidth = stackedAreaMarginWidth;
    let niceAxis = sliderBoxPreferences.displayNiceAxis;
    let tickHeight = sliderBoxPreferences.tickHeight;
    let contextHeight = sliderBoxPreferences.height;

    //1)First we add the context and we draw a horizontal line so we see it well
    sliderBox = svg
    .append("g")
    .attr("class", "sliderBox")
    .attr(
      "transform",
      "translate(" +
      stackedAreaMargin.left +
      "," +
      (stackedAreaMargin.top + stackedAreaMargin.height + 20) +
      ")"
    );


    // Create a domain
    brushXScale = d3
    .scaleTime()
    .range([0, sliderWidth]) //length of the slider
    .domain([smallestDate, biggestDate]);

    if (niceAxis) {
      brushXScale = brushXScale.nice();
    }
    // a function thag generates a bunch of SVG elements.
    var contextAxis = d3
    .axisBottom(brushXScale)
    .tickPadding(5) //height of the date on the axis
    .tickSizeInner(tickHeight)
    .tickSizeOuter(0);
    //.tickFormat(d3.timeFormat('%Y'))
    //.tickValues([2006, 2008, 2010,2012, 2014, 2016, 2018])
    //.tickArguments([29])
    //.ticks(30)
    //.ticks(15, d3.timeFormat('%Y'))
    //.tickFormat(x => /[AEIOUY]/.test(x) ? x : "")

    //append the axis to the svg element
    sliderBox
    .append("g")
    .attr("transform", "translate(" + 0 + "," + contextHeight / 2 + ")")
    .call(contextAxis);

    //move the ticks to position them in the middle of the horizontal line
    sliderBox
    .selectAll(".tick line")
    .attr("transform", "translate(0,-" + tickHeight / 2 + ")");

    //moves the text accordingly
    sliderBox
    .selectAll(".tick text")
    .attr("transform", "translate(0,-" + tickHeight / 2 + ")");

    if (!niceAxis) {
      //then draw line at end of axis
      const outerTickSize = tickHeight * 1.5;
      const yTop = (contextHeight - outerTickSize) / 2;
      const yBottom = (contextHeight + outerTickSize) / 2;
      const xLeft = 0;
      const xRight = xLeft + sliderWidth;
      sliderBox
      .append("line")
      .attr("x1", xLeft)
      .attr("y1", yTop)
      .attr("x2", xLeft)
      .attr("y2", yBottom)
      .attr("class", "outerTick");
      sliderBox
      .append("line")
      .attr("x1", xRight)
      .attr("y1", yTop)
      .attr("x2", xRight)
      .attr("y2", yBottom)
      .attr("class", "outerTick");
    }

    //Now we do the brush
    const minYBrushable = 0; //;(contextHeight-selectedRectHeight)/2
    const maxYBrushable = contextHeight;
    const minXBrushable = 0;
    const maxXBrushable = stackedAreaMarginWidth;
    bbrush = d3
    .brushX()
    .extent([
      //sets the brushable part
      //idea use this to avoid selecting outside the range when nice axis is displayed
      [minXBrushable, minYBrushable],
      [maxXBrushable, maxYBrushable],
    ])
    .on("brush", cleanBrushInterval);

    positionBrush(null, null);

    // Brush handler. Get time-range from a brush and pass it to the charts.
    function cleanBrushInterval() {
      //d3.event.selection looks like [622,698] for example
      //b is then an array of 2 dates: [from, to]
      var b =
      d3.event.selection === null
      ? brushXScale.domain()
      : d3.event.selection.map((x) => {
        return brushXScale.invert(x);
      });

      //first we make sure that we cannot zoom too much
      b = getCleanedInterval(b);
      timeIntervalSelected = b;
      onBrush();
    }
  } //end of createSlider

  function positionBrush(fromDate, toDate) {
    let position = null;
    if (fromDate != null && toDate != null) {
      let minX = brushXScale(fromDate);
      let maxX = brushXScale(toDate);
      position = [minX, maxX];
    }
    sliderBox.select(".xbrush").remove();
    toCallForBrush = sliderBox
    .append("g")
    .attr("class", "xbrush")
    .call(bbrush)
    .call(bbrush.move, position)
    .selectAll("rect");

    let elem = sliderBox
    .select(".xbrush")
    .select(".overlay")
    .on("mousedown", function () {
      timeIntervalSelected = [smallestDate, biggestDate];
      onBrush();
    });
  }

  function getCleanedInterval(b) {
    if (minNumberOfPointInScreen > 0) {
      //in case we have a limit
      let differenceInTime = b[1].getTime() - b[0].getTime();
      let minTimeInterval = getMinTimeIntervalWeCanSee();
      if (differenceInTime < minTimeInterval) {
        //in case the brush does not respect the limit
        let middleTime = (b[1].getTime() + b[0].getTime()) / 2;

        let timeToAdd = minTimeInterval / 2;
        let upperDate = middleTime + timeToAdd;
        let lowerDate = middleTime - timeToAdd;

        if (upperDate > biggestDate.getTime()) {
          let timeToShift = upperDate - biggestDate.getTime();
          upperDate -= timeToShift;
          lowerDate -= timeToShift;
        } else if (lowerDate < smallestDate.getTime()) {
          let timeToShift = smallestDate.getTime() - lowerDate;
          upperDate += timeToShift;
          lowerDate += timeToShift;
        }
        let small_date = new Date(lowerDate);
        let big_date = new Date(upperDate);
        b = [small_date, big_date];
      }
      let small_date = b[0];
      let big_date = b[1];
      return [small_date, big_date];
    }
    return b;
  }


  function getDataInOrder(data, order, chartId){
    let ordered = []
    let position = 0
    order.forEach((o,i)=>{
      ordered.push(data[o])
      if(o == chartId){
        position = i
      }
    })
    return {
      order: ordered,
      position: position,
    }
  }

  class Chart {
    constructor(options) {
      this.data = options.data;
      this.id = options.id;
      this.xScale = getXscale();
      this.yScale = getYscale();
      const stacksSupperpose = options.stacksSupperpose;
      const streamChartWhenSupperPosed = options.streamChartWhenSupperPosed;

      let localName = this.data.categories[this.id];
      let localId = this.id;
      let xS = this.xScale;
      let yS = this.yScale;
      let dataOrder = options.dataOrder;

      this.area = d3
      .area()
      .x(function (d) {
        return xS(d.date);
      })
      .y0(
        function (d) {
          if (stacksSupperpose) {
            if (streamChartWhenSupperPosed) {
              //steam chart
              let orderWithPosition = getDataInOrder(d.values, dataOrder,localId)
              let ordered = orderWithPosition.order
              let pos = orderWithPosition.position

              let toAdd = 0;
              let totalSum = ordered.slice().reduce((a, b) => a + b, 0);
              let halfHeight = yS(totalSum / 2);
              toAdd = stackedAreaMargin.height / 2 - halfHeight;
              let values = ordered.slice(0, pos);
              let previousSum = values.reduce((a, b) => a + b, 0);
              return yS(previousSum) + toAdd;
            } else {
              //normal stacked area

              let orderWithPosition = getDataInOrder(d.values, dataOrder,localId)
              let ordered = orderWithPosition.order
              let pos = orderWithPosition.position

              let values = ordered.slice(0, pos);
              let previousSum = values.reduce((a, b) => a + b, 0);
              return yS(previousSum);

            }
          } else {
            //chart interleaving, everything from zero
            return yS(0);
          }
        }.bind(this)
      )
      .y1(
        function (d) {
          if (stacksSupperpose) {
            if (streamChartWhenSupperPosed) {
              //steam chart
              let orderWithPosition = getDataInOrder(d.values, dataOrder,localId)
              let ordered = orderWithPosition.order
              let pos = orderWithPosition.position

              let totalSum = ordered.slice().reduce((a, b) => a + b, 0);
              let halfHeight = yS(totalSum / 2);
              let toAdd = stackedAreaMargin.height / 2 - halfHeight;
              let values = ordered.slice(0, pos + 1);
              let previousSum = values.reduce((a, b) => a + b, 0);
              return yS(previousSum) + toAdd;
            } else {
              //normal stacked area

              let orderWithPosition = getDataInOrder(d.values, dataOrder,localId)
              let ordered = orderWithPosition.order
              let pos = orderWithPosition.position

              let values = ordered.slice(0, pos + 1);
              let previousSum = values.reduce((a, b) => a + b, 0);
              return yS(previousSum);
            }
          } else {
            //chart interleaving, simply return the top value
            return yS(d.values[this.id]);
          }
        }.bind(this)
      )
      .curve(curveType);
      this.showOnly = function (b) {
        this.xScale.domain(b);
        this.path.data([this.data.values]).attr("d", this.area);
        if (this.frontPath != undefined) {
          this.frontPath.data([this.data.values]).attr("d", this.area);
        }
      };

      this.rescaleY = function (maxY) {
        this.yScale.domain([0, maxY]);
        this.path.data([this.data.values]).attr("d", this.area);
        if (this.frontPath != undefined) {
          this.frontPath.data([this.data.values]).attr("d", this.area);
        }
      };
    } //end of constructor
  }

  class UpperLine {
    constructor(options) {
      this.data = options.data;
      this.id = options.id;
      this.xScale = getXscale();
      this.yScale = getYscale();
      const stacksSupperpose = options.stacksSupperpose;

      let localName = this.data.categories[this.id];
      let localId = this.id;
      let xS = this.xScale;
      let yS = this.yScale;

      this.upperPath = d3
      .line()
      .x(function (d) {
        return xS(d.date);
      })
      .y(
        function (d) {
          if (stacksSupperpose) {
            let values = d.values.slice(0, localId + 1);
            let previousSum = values.reduce((a, b) => a + b, 0);
            return yS(previousSum);
          } else {
            return yS(d.values[this.id]);
          }
        }.bind(this)
      )
      .curve(curveType);

      this.showOnly = function (b) {
        this.xScale.domain(b);
        this.path.data([this.data.values]).attr("d", this.upperPath);
      };
      this.rescaleY = function (maxY) {
        this.yScale.domain([0, maxY]);
        this.path.data([this.data.values]).attr("d", this.upperPath);
      };
    } //end of constructor
  }

  function createChart(options) {
    return new Chart(options);
  }

  function createUpperLine(options) {
    return new UpperLine(options);
  }

  function getXscale() {
    return d3
    .scaleTime()
    .range([0, stackedAreaMarginWidth])
    .domain(timeIntervalSelected);
  }

  function getYscale() {
    return d3
    .scaleLinear()
    .range([stackedAreaMargin.height, 0])
    .domain([0, maxYscore]);
  }

  function drawXAxis() {
    //remove the previous axis
    svg.select(".xAxis").remove();
    //and recreate the new axis
    let xAxis = d3.axisBottom(getXscale());
    svg
    .append("g")
    .attr("class", "xAxis")
    .attr(
      "transform",
      "translate(" +
      stackedAreaMargin.left +
      "," +
      (stackedAreaMargin.height + stackedAreaMargin.top) +
      ")"
    )
    .call(xAxis);
  }

  function drawYAxis() {
    //remove the previous axis
    svg.select(".yAxis").remove();
    //and recreate the new axis
    let yAxis = d3.axisLeft(getYscale()).tickFormat(d3.format(".2s"));
    svg
    .append("g")
    .attr("class", "yAxis")
    .attr(
      "transform",
      "translate(" +
      stackedAreaMargin.left +
      "," +
      stackedAreaMargin.top +
      ")"
    )
    .call(yAxis);
  }

  function isADrag(x1, y1, x2, y2) {
    let dragDistance = 5;
    let norm = Math.pow(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2), 0.5);
    return norm > dragDistance;
  }

  function renderCharts(charts, withStroke) {
    removeCharts();
    chartsContainer = stackedArea
    .append("g")
    .attr("class", "chartsContainer");
    charts.forEach((chart) => {
      chart.path = chartsContainer
      .append("path")
      .data([chart.data.values])
      .attr("class", "chart")
      .attr("id", "chart_nb_" + chart.id)
      .attr("d", chart.area)
      .attr("fill", colorForIndex(chart.id));

      if (withStroke) {
        chart.path.attr("stroke", "black").attr("stroke-width", "1");
      }

      chart.path.on("mousemove", function (e) {
        let coordinateX = d3.mouse(this)[0];
        let dateSelected = getXscale().invert(coordinateX);
        isMovingDown(dateSelected, d3.event.clientY, d3.event.clientX);
      });

      let domElement = document.getElementById("chart_nb_" + chart.id);
      domElement.addEventListener("mousemove", function (e) {
        //mouse is moving in a chart

        //so the function moving outside a chart will not be called
        e.stopPropagation();
        App.YoutubePlayer.mouseIsMoving(e);
      });

      chart.path.on("mouseover", function (e) {
        if (!isMouseDown) {
          App.Plot1.mouseInChart(chart.id);
        }
      });

      chart.path.on("click", function (e) {
        //click inside a chart

        if (
          mouseDownCoordinates == null ||
          !isADrag(
            d3.event.clientX,
            d3.event.clientY,
            mouseDownCoordinates.x,
            mouseDownCoordinates.y
          )
        ) {
          App.Plot1.mouseClickedInPartOfChart(chart.id);
        }
      });
    });
  }

  function removeCharts() {
    stackedArea.select(".chartsContainer").remove();
    chartsContainer = null;
  }

  function removeLines() {
    stackedArea.select(".upperLinesContainer").remove();
  }

  function renderUpperLines(lines) {
    removeLines();
    let linesContainer = stackedArea
    .append("g")
    .attr("class", "upperLinesContainer");

    lines.forEach((line) => {
      line.path = linesContainer
      .append("path")
      .data([line.data.values])
      .attr("class", "chart")
      .attr("id", "chart_nb_" + line.id)
      .attr("d", line.upperPath)
      .attr("stroke", "black");
      line.upperPathElem = document.getElementById("chart_nb_" + line.id);
    });
  }

  function removePartsOfChart() {
    stackedArea.select(".chartFrames").remove();
    partOfChartContainer = null;
  }

  function hideFrameContainer() {
    if (partOfChartContainer != null) {
      partOfChartContainer.attr("opacity", 0);
    }
  }

  function showFrameContainer() {
    if (partOfChartContainer != null) {
      partOfChartContainer.attr("opacity", 1);
    }
  }

  function addPartsOfChart(
    leftTimeBorder,
    orderTimeStamps,
    stacksSupperpose,
    data
  ) {
    removePartsOfChart();
    partOfChartContainer = stackedArea
    .append("g")
    .attr("class", "chartFrames");

    let mvb = App.Plot1DataModel.pixelStepWidth();

    orderTimeStamps.forEach((interleavings, n) => {
      let startingBorder = leftTimeBorder;
      interleavings.forEach((interleaving, i) => {
        let endingBorder = interleaving[1];
        //trick to go beyong if the next border is too small
        if (i + 1 < interleavings.length) {
          let nextEndingBorder = interleavings[i + 1][1];
          let nextWidth =
          getXscale()(nextEndingBorder) - getXscale()(endingBorder);
          if (nextWidth < mvb) {
            endingBorder = nextEndingBorder;
          }
        }

        let widthX = getXscale()(endingBorder) - getXscale()(startingBorder);
        if (widthX >= mvb) {
          partOfChartContainer
          .append("clipPath")
          .attr("id", "clip_for_frame_" + n + "_" + i)
          .append("rect")
          .attr("x", getXscale()(startingBorder))
          .attr("y", 0)
          .attr("height", stackedAreaMargin.height)
          .attr("width", widthX);

          let newIncompleteChart = createChart({
            data: data,
            id: interleaving[0],
            stacksSupperpose: stacksSupperpose,
            xScale: getXscale(),
            yScale: getYscale(),
          });

          //add the area
          partOfChartContainer
          .append("path")
          .data([newIncompleteChart.data.values])
          .attr("class", "partOfchart")
          .attr("d", newIncompleteChart.area)
          .attr("fill", colorForIndex(newIncompleteChart.id))
          .attr("clip-path", "url(#clip_for_frame_" + n + "_" + i + ")")
          .attr("id", "partOfChart_" + n + "_" + i)
          .on("click", function (e) {
            if (
              mouseDownCoordinates == null ||
              !isADrag(
                d3.event.clientX,
                d3.event.clientY,
                mouseDownCoordinates.x,
                mouseDownCoordinates.y
              )
            ) {

              App.Plot1.mouseClickedInPartOfChart(newIncompleteChart.id);
            }
          })
          .on("mouseenter", function (e) {
            App.Plot1.mouseInPartOfChart(newIncompleteChart.id);
          }).on("mousemove", function (e) {
            let coordinateX = d3.mouse(this)[0];
            let dateSelected = getXscale().invert(coordinateX);
            App.Plot1.mouseMoveInPartOfChart(newIncompleteChart.id, dateSelected);
          })

          /*let domElement = document.getElementById("partOfChart_" + n + "_" + i);
          domElement.addEventListener("mousemove", function (e) {
          //mouse is moving in a part of a chart
          //so the function moving outside a chart will not be called
          //e.stopPropagation();
          //App.YoutubePlayer.mouseIsMoving(e);
        });*/





      }
      startingBorder = endingBorder;
    });
  });
}

function removeFrontCharts() {
  stackedArea.select(".frontAreasContainer").remove();
  frontChartsPaths = null;
  if (chartsContainer != null) {
    chartsContainer.attr("opacity", 1);
  }
}

function addFrontCharts(indexSelected, charts) {
  removeFrontCharts();
  frontChartsPaths = [];
  chartsContainer.attr("opacity", 0);
  let container = stackedArea
  .append("g")
  .attr("class", "frontAreasContainer");
  charts.forEach((chart) => {
    if (chart.id != indexSelected) {
      let path = container
      .append("path")
      .data([chart.data.values])
      .attr("class", "chart")
      .attr("id", "front_chart_nb_" + chart.id)
      .attr("d", chart.area)
      .attr("fill", colorForFadingIndex(chart.id));
      frontChartsPaths.push(path);
      chart.frontPath = path;
    }
  });

  let chart = charts[indexSelected];
  let path = container
  .append("path")
  .data([chart.data.values])
  .attr("class", "chart")
  .attr("id", "front_chart_nb_" + chart.id)
  .attr("d", chart.area)
  .attr("fill", colorForIndex(chart.id))
  .attr("stroke", "black");
  chart.frontPath = path;
  frontChartsPaths.push(path);

  lastIndexHighlighted = indexSelected;
  addEventListenersInFrontChart(indexSelected, frontChartsPaths, charts);
}

function updateTitles(indexSelected, indexClicked) {
  titles.forEach((title, i) => {
    let state = 1 //normal state
    if((indexSelected >= 0 || indexClicked >=0) && i !=indexSelected && i != indexClicked ){
      state = 2//hidden
    }else if(indexSelected ==i && indexClicked!=i){
      state = 3//hover
    }else if(indexClicked==i){
      state = 4//selected
    }
    updateTitleUI(title, i,state);
  });
}

function updateTitleUI(title, index, state) {
  //4 states:
  //1) normal: normal color, no border, no backgroundColor
  //2) hidden: fading color, no border no backgroundColor
  //3) hover: normal color with border without background
  //4)selected: normal color with border and background

  if(state == 1){
    title.style.color = colorForIndex(index)
    title.style.border = null;
    title.style.background = null;
  }else if(state == 2){
    title.style.color = colorForFadingIndex(index)
    title.style.border = null;
    title.style.background = null;
    title.style.background = null;
  }else if(state == 3){
    title.style.color = colorForIndex(index)
    title.style.border = "2px solid";
    title.style.borderRadius = "0.5em";
    title.style.background = null;
  }else{
    title.style.color = colorForIndex(index)
    title.style.border = "2px solid";
    title.style.borderRadius = "0.5em";
    title.style.background = null;
    title.style.background = colorForFadingIndex(index);
  }
}

function addEventListenersInFrontChart(indexSelected,frontChartsPaths,charts) {
  frontChartsPaths.forEach((path, id) => {
    path.on("mousemove", function (e) {
      let coordinateX = d3.mouse(this)[0];
      let dateSelected = getXscale().invert(coordinateX);
      if (!isMouseDown) {
        App.Plot1.mouseMoveInFrontChart(indexSelected, dateSelected);
      }else{
        isMovingDown(dateSelected, d3.event.clientY, d3.event.clientX);
      }
    });

    path.on("click", function () {
      if (
        mouseDownCoordinates == null ||
        !isADrag(
          d3.event.clientX,
          d3.event.clientY,
          mouseDownCoordinates.x,
          mouseDownCoordinates.y
        )
      ) {
        let coordinateX = d3.mouse(this)[0];
        let dateSelected = getXscale().invert(coordinateX);
        let id = parseInt(path.attr("id").slice(-1));
        /*if (id == categorySelected.value) {
        categorySelected.value = null;
      } else {
      categorySelected.value = id;
    }*/
    App.Plot1.clickInFrontChart(id);
  }
});

let domEl = document.getElementById("front_chart_nb_" + id);
domEl.addEventListener("mousemove", function (e) {
  //moving in front chart
  if (id != lastIndexHighlighted && !isMouseDown) {
    App.Plot1.mouseInChart(id)
  }

  //wont call moving outside a chart
  e.stopPropagation();
  App.YoutubePlayer.mouseIsMoving(e);
});
});
}

function removeVerticalLines() {
  removeDate();
  stackedArea.select(".verticalLinesContainer").remove();
}

function removeDate() {
  svg.select("#currentDateDisplayed").remove();
}

function addDate(timestamp, date, color) {
  removeDate();
  let year = date.getFullYear();
  let month = ("0" + (date.getMonth() + 1)).slice(-2);
  let day = ("0" + date.getDate()).slice(-2);
  let x = getXscale()(new Date(timestamp)) + stackedAreaMargin.left;
  let y = stackedAreaMargin.top;
  svg
  .append("text")
  .attr("id", "currentDateDisplayed")
  .attr("transform", "translate(" + x + "," + (y - 3) + ")")
  .text(day + "-" + month + "-" + year)
  .attr("fill", color)
  .attr("text-anchor", "middle");
}

function addVerticalLines(timestamps, color, dateToDisplay) {
  removeVerticalLines();
  if(timestamps.length == 0){
    return;
  }
  let goodTimeStamp = Math.min(
    timeIntervalSelected[1].getTime(),
    Math.max(timeIntervalSelected[0].getTime(), timestamps[0])
  );
  addDate(goodTimeStamp, dateToDisplay, color);
  let linesContainer = stackedArea
  .append("g")
  .attr("class", "verticalLinesContainer");

  let y = 0;
  let Y = stackedAreaMargin.height;
  let x = getXscale()(new Date(goodTimeStamp));
  linesContainer
  .append("line")
  .attr("x1", x)
  .attr("y1", y)
  .attr("x2", x)
  .attr("y2", Y)
  .attr("class", "verticalLines")
  .attr("stroke", color);
}

function updateColor(color) {
  stackedArea.select(".verticalLines").attr("stroke", color)
  svg.select("#currentDateDisplayed").attr("fill", color)
}

function colorForIndex(index) {
  /*var colors = [
    "#0DEDBA  ",
    "#3097E9",
    "#8328E1",
    "#D3143C",
    "#FD7D06",
    "#F3FF00",
    "#15E500 ",
  ];*/
  var colors = [
    "#FD612C  ",
    "#62D26F",
    "#E362E3",
    "#AA62E3",
    "#E8384F",
    "#20AAEA",
    "#EEC300 ",
  ];
  return colors[index % colors.length];
}
function colorForFadingIndex(index) {
  var colors = [
    "#752b12",
    "#2a5c30",
    "#5c285c",
    "#583275",
    "#691a24",
    "#105373",
    "#6e5a00",
  ];
  return colors[index % colors.length];
}

function setZoomOutButtonVisible(newValue){
  document.getElementById("zoomOutButton").style.visibility = newValue ? "visible" : "hidden"
}

return {
  setData: setData,
  prepareElements: function () {
    createTitles();
    prepareSVGElement();
    createSlider();
    drawXAxis();
    drawYAxis();
  },
  getXscale: getXscale,
  getYscale: getYscale,
  drawYAxis: drawYAxis,
  createChart: createChart,
  createUpperLine: createUpperLine,
  renderCharts: renderCharts,
  renderUpperLines: renderUpperLines,
  addPartsOfChart: addPartsOfChart,
  removePartsOfChart: removePartsOfChart,
  removeLines: removeLines,
  removeCharts: removeCharts,
  addFrontCharts: addFrontCharts,
  removeFrontCharts: removeFrontCharts,
  updateTitles: updateTitles,
  addVerticalLines: addVerticalLines,
  removeVerticalLines:removeVerticalLines,
  updateColor: updateColor,
  colorForIndex: colorForIndex,
  colorForFadingIndex: colorForFadingIndex,
  showFrameContainer: showFrameContainer,
  hideFrameContainer: hideFrameContainer,
  setZoomOutButtonVisible:setZoomOutButtonVisible,
};
})();
App.Plot1UI = Plot1UI;
window.App = App;
})(window);
