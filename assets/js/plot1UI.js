(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1UI = (function () {
    const containerName = "plot1_container";
    const titleContainerId = "plot1_title_container";
    let titles = null;
    const svgWidth = document.getElementById(containerName).clientWidth;
    const svgHeight = document.getElementById(containerName).clientHeight;

    //-------------SOME UI PARAMTER TO TUNE-------------

    let minNumberOfPointInScreen = 50;
    let curveType = d3.curveLinear;
    //'curveMonotoneX','curveLinear','curveBasis', 'curveCardinal', 'curveStepBefore',...

    const stackedAreaMargin = {
      top: 0,
      left: 70,
      width: svgWidth * 0.9,
      height: 350,
    };

    const sliderBoxPreferences = {
      height: 60,
      sliderWidth: 0.9,
      tickHeight: 10,
      displayNiceAxis: false,
      selectedRectHeight: 50,
    };

    //------------------------------------------------
    let svg = null;
    let stackedArea = null;
    let stackedAreaBorderLines = null;
    let timeIntervalSelected = null;
    let chartsContainer = null;
    let frontChartsPaths = null;
    let lastIndexHighlighted = null;
    let categorySelected = null;
    let partOfChartContainer = null;

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

    function prepareSVGElement() {
      //delete the previous svg element
      d3.select("#plot1_container").select("svg").remove();

      //create a new svg element
      svg = d3
        .select("#plot1_container")
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight);

      svg.on("mouseout", function () {
        removeVerticalLines();
      });

      svg
        .append("clipPath")
        .attr("id", "clipForStackedArea")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", stackedAreaMargin.height)
        .attr("width", stackedAreaMargin.width);

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
      /*stackedAreaBorderLines.append("line") .attr("x1", 0) .attr("y1", 0).attr("x2", stackedAreaMargin.width) .attr("y2", 0).attr("class", "stackedAreaBorder");
      //bottom
      stackedAreaBorderLines.append("line") .attr("x1", 0) .attr("y1", stackedAreaMargin.height).attr("x2", stackedAreaMargin.width) .attr("y2", stackedAreaMargin.height).attr("class", "stackedAreaBorder");
      //left
      stackedAreaBorderLines.append("line") .attr("x1", 0) .attr("y1", 0).attr("x2", 0) .attr("y2", stackedAreaMargin.height).attr("class", "stackedAreaBorder");
      //right
      stackedAreaBorderLines.append("line") .attr("x1", stackedAreaMargin.width) .attr("y1", 0).attr("x2", stackedAreaMargin.width) .attr("y2", stackedAreaMargin.height).attr("class", "stackedAreaBorder");*/

      svg.on("mousemove", function () {
        let coordinateX = d3.mouse(this)[0];
        let coordinateY = d3.mouse(this)[1];
        let tolerancePixel = 10;
        if (
          coordinateX > stackedAreaMargin.left - tolerancePixel &&
          coordinateX <
            stackedAreaMargin.left + stackedAreaMargin.width + tolerancePixel &&
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
          App.Plot1.mouseMoveOutOfCharts(dateSelected);
        } else {
          removeVerticalLines();
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
          if (i == categorySelected) {
            categorySelected = null;
          } else {
            categorySelected = i;
          }
          App.Plot1.userSelectedCategory(categorySelected);
        });
        titles.push(title);
      });
    }

    /*Create the slider box with the brush*/
    function createSlider() {
      timeIntervalSelected = [smallestDate, biggestDate];

      let sliderWidth = sliderBoxPreferences.sliderWidth * svgWidth;
      let niceAxis = sliderBoxPreferences.displayNiceAxis;
      let tickHeight = sliderBoxPreferences.tickHeight;
      let contextHeight = sliderBoxPreferences.height;
      let selectedRectHeight = sliderBoxPreferences.selectedRectHeight;

      //1)First we add the context and we draw a horizontal line so we see it well
      let silderBox = svg
        .append("g")
        .attr("class", "sliderBox")
        .attr(
          "transform",
          "translate(" +
            0 +
            "," +
            (svgHeight - sliderBoxPreferences.height) +
            ")"
        );

      //drawing the separation line
      silderBox
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", svgWidth)
        .attr("y2", 0)
        .attr("class", "topLine");
      // Create a domain
      var contextXScale = d3
        .scaleTime()
        .range([0, sliderWidth]) //length of the slider
        .domain([smallestDate, biggestDate]);

      if (niceAxis) {
        contextXScale = contextXScale.nice();
      }
      // a function thag generates a bunch of SVG elements.
      var contextAxis = d3
        .axisBottom(contextXScale)
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
      silderBox
        .append("g")
        .attr(
          "transform",
          "translate(" +
            (svgWidth - sliderWidth) / 2 +
            "," +
            contextHeight / 2 +
            ")"
        )
        .call(contextAxis);

      //move the ticks to position them in the middle of the horizontal line
      silderBox
        .selectAll(".tick line")
        .attr("transform", "translate(0,-" + tickHeight / 2 + ")");

      //moves the text accordingly
      silderBox
        .selectAll(".tick text")
        .attr("transform", "translate(0,-" + tickHeight / 2 + ")");

      if (!niceAxis) {
        //then draw line at end of axis
        const outerTickSize = tickHeight * 1.5;
        const yTop = (contextHeight - outerTickSize) / 2;
        const yBottom = (contextHeight + outerTickSize) / 2;
        const xLeft = (svgWidth - sliderWidth) / 2;
        const xRight = xLeft + sliderWidth;
        silderBox
          .append("line")
          .attr("x1", xLeft)
          .attr("y1", yTop)
          .attr("x2", xLeft)
          .attr("y2", yBottom)
          .attr("class", "outerTick");
        silderBox
          .append("line")
          .attr("x1", xRight)
          .attr("y1", yTop)
          .attr("x2", xRight)
          .attr("y2", yBottom)
          .attr("class", "outerTick");
      }

      //Now we do the brush
      const minYBrushable = 0; //;(contextHeight-selectedRectHeight)/2
      const maxYBrushable = (contextHeight + selectedRectHeight) / 2;
      const minXBrushable =
        contextXScale(smallestDate) + (svgWidth - sliderWidth) / 2;
      const maxXBrushable =
        contextXScale(biggestDate) + (svgWidth - sliderWidth) / 2;
      var brush = d3
        .brushX()
        .extent([
          //sets the brushable part
          //idea use this to avoid selecting outside the range when nice axis is displayed
          [minXBrushable, minYBrushable],
          [maxXBrushable, maxYBrushable],
        ])
        .on("brush", cleanBrushInterval);

      //The selection rectangle
      silderBox
        .append("g")
        .attr("class", "xbrush")
        .call(brush)
        .selectAll("rect")
        .attr("rx", 5);
      let elem = silderBox
        .select(".xbrush")
        .select(".overlay")
        .on("click", function () {
          timeIntervalSelected = [smallestDate, biggestDate];
          onBrush(timeIntervalSelected);
        });

      // Brush handler. Get time-range from a brush and pass it to the charts.
      function cleanBrushInterval() {
        //d3.event.selection looks like [622,698] for example
        //b is then an array of 2 dates: [from, to]
        var b =
          d3.event.selection === null
            ? contextXScale.domain()
            : d3.event.selection.map((x) => {
                return contextXScale.invert(x - (svgWidth - sliderWidth) / 2);
              });

        //first we make sure that we cannot zoom too much
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
          //now we should adapt the brush!!

          let brushSelected = silderBox.select(".xbrush");
          let selection = brushSelected.select(".selection");
          let leftSlider = brushSelected.select(".handle--w");
          let rightSlider = brushSelected.select(".handle--e");

          let widthForBrush =
            contextXScale(big_date) - contextXScale(small_date);
          let leftSliderWidth = leftSlider.attr("width");
          let xForLeft =
            contextXScale(small_date) +
            (svgWidth - sliderWidth - leftSliderWidth) / 2;
          let xForRight = xForLeft + widthForBrush;

          selection.attr("width", widthForBrush);
          selection.style("x", xForLeft + leftSliderWidth / 2);
          leftSlider.style("x", xForLeft);
          rightSlider.style("x", xForRight);
        }
        timeIntervalSelected = b;
        onBrush();
      }
    } //end of createSlider

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

        this.area = d3
          .area()
          .x(function (d) {
            return xS(d.date);
          })
          .y0(
            function (d) {
              if (stacksSupperpose) {
                let toAdd = 0;
                if (streamChartWhenSupperPosed) {
                  let totalSum = d.values.slice().reduce((a, b) => a + b, 0);
                  let halfHeight = yS(totalSum / 2);
                  toAdd = +stackedAreaMargin.height / 2 - halfHeight;
                }

                let values = d.values.slice(0, localId);
                let previousSum = values.reduce((a, b) => a + b, 0);

                return yS(previousSum) + toAdd;
              } else {
                return yS(0);
              }
            }.bind(this)
          )
          .y1(
            function (d) {
              if (stacksSupperpose) {
                let toAdd = 0;
                if (streamChartWhenSupperPosed) {
                  let totalSum = d.values.slice().reduce((a, b) => a + b, 0);
                  let halfHeight = yS(totalSum / 2);
                  toAdd = +stackedAreaMargin.height / 2 - halfHeight;
                }
                let values = d.values.slice(0, localId + 1);
                let previousSum = values.reduce((a, b) => a + b, 0);
                return yS(previousSum) + toAdd;
              } else {
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
        .range([0, stackedAreaMargin.width])
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
      let yAxis = d3.axisLeft(getYscale());
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

        let domElement = document.getElementById("chart_nb_" + chart.id);
        domElement.addEventListener("mousemove", function (e) {
          e.stopPropagation();
        });

        chart.path.on("mouseover", function (e) {
          App.Plot1.mouseInChart(chart.id);
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
        /*.on("mousemove", function(d,i) {
        let coordinateX= d3.mouse(this)[0];
        let dateSelected =xScale.invert(coordinateX)
        onHover(chart.id, dateSelected)})*/
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

      orderTimeStamps.forEach((interleavings, n) => {
        let startingBorder = leftTimeBorder;
        interleavings.forEach((interleaving, i) => {
          let endingBorder = interleaving[1];

          let widthX = getXscale()(endingBorder) - getXscale()(startingBorder);
          if (widthX >= 1.5) {
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
                if (interleaving[0] == categorySelected) {
                  categorySelected = null;
                } else {
                  categorySelected = interleaving[0];
                }
                App.Plot1.mouseClickedInPartOfChart(categorySelected);
              });
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

    function makeTitlesLookNormal() {
      titles.forEach((title, i) => {
        title.style.color = colorForIndex(i);
        title.style.border = null;
        title.style.background = null;
      });
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
      updateTitles(indexSelected, -1);
    }

    function updateTitles(indexSelected, indexClicked) {
      titles.forEach((title, i) => {
        updateTitleUI(title, i, i == indexSelected, i == indexClicked);
      });
    }

    function updateTitleUI(title, index, isSelected, isClicked) {
      title.style.color = isSelected
        ? colorForIndex(index)
        : colorForFadingIndex(index);
      if (isSelected || isClicked) {
        title.style.border = "2px solid";
        title.style.borderRadius = "0.5em";
        if (isClicked) {
          title.style.background = colorForFadingIndex(index);
        } else {
          title.style.background = null;
        }
      } else {
        title.style.border = null;
        title.style.background = null;
      }
    }

    function addEventListenersInFrontChart(
      indexSelected,
      frontChartsPaths,
      charts
    ) {
      frontChartsPaths.forEach((path, id) => {
        path.on("mousemove", function (e) {
          let coordinateX = d3.mouse(this)[0];
          let dateSelected = getXscale().invert(coordinateX);
          App.Plot1.mouseMoveInFrontChart(indexSelected, dateSelected);
        });

        path.on("click", function (e) {
          let coordinateX = d3.mouse(this)[0];
          let dateSelected = getXscale().invert(coordinateX);
          let id = parseInt(path.attr("id").slice(-1));
          if (id == categorySelected) {
            categorySelected = null;
          } else {
            categorySelected = id;
          }
          App.Plot1.userSelectedCategory(categorySelected);
          App.Plot1.mouseMoveInFrontChart(id, dateSelected);
        });

        let domEl = document.getElementById("front_chart_nb_" + id);
        domEl.addEventListener("mousemove", function (e) {
          if (id != lastIndexHighlighted && categorySelected == null) {
            addFrontCharts(id, charts);
          }
          e.stopPropagation();
        });
      });
    }

    function removeVerticalLines() {
      stackedArea.select(".verticalLinesContainer").remove();
    }

    function addVerticalLines(timestamps, color) {
      removeVerticalLines();
      let linesContainer = stackedArea
        .append("g")
        .attr("class", "verticalLinesContainer");

      timestamps.forEach((t) => {
        let y = 0;
        let Y = stackedAreaMargin.height;
        let x = getXscale()(new Date(t));
        linesContainer
          .append("line")
          .attr("x1", x)
          .attr("y1", y)
          .attr("x2", x)
          .attr("y2", Y)
          .attr("class", "verticalLines")
          .attr("stroke", color);
      });
    }

    function setCategorySelectedToNull() {
      categorySelected = null;
    }

    function colorForIndex(index) {
      var colors = [
        "#32a852",
        "#2b90ab",
        "#d1d138",
        "#fa8350",
        "#b32929",
        "#493782",
        "#968a60",
      ];
      return colors[index % colors.length];
    }
    function colorForFadingIndex(index) {
      var colors = [
        "#bcf5cc",
        "#bce9f5",
        "#fafac5",
        "#fad5c5",
        "#f0b9b9",
        "#c4b6f2",
        "#ede3c0",
      ];
      return colors[index % colors.length];
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
      makeTitlesLookNormal: makeTitlesLookNormal,
      addVerticalLines: addVerticalLines,
      colorForIndex: colorForIndex,
      setCategorySelectedToNull: setCategorySelectedToNull,
      showFrameContainer: showFrameContainer,
      hideFrameContainer: hideFrameContainer,
    };
  })();
  App.Plot1UI = Plot1UI;
  window.App = App;
})(window);
