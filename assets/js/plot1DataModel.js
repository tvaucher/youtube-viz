(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1DataModel = (function () {
    /**From the csv file, task is to return the data object*/
    function prepareData(csvData) {
      //getting all the categories
      let categories = [];
      for (let prop in csvData[0]) {
        if (csvData[0].hasOwnProperty(prop)) {
          if (prop != "date") {
            categories.push(prop);
          }
        }
      }

      let maxSingleScore = Number.MIN_VALUE;
      let maxScoreAtTimeStamp = Number.MIN_VALUE;
      //mapping each line to an array
      let arrayData = csvData.map((d) => {
        //for each date:
        let values = [];
        for (let prop in d) {
          //for each category:
          if (d.hasOwnProperty(prop) && prop != "date") {
            values.push(parseFloat(d[prop]));
          }
        }

        let date = new Date(Date.parse(d.date));
        let localSingleMax = values.reduce((a, b) => (a > b ? a : b), 0);
        let localTemporalMax = values.reduce((a, b) => a + b, 0);

        if (localSingleMax > maxSingleScore) {
          maxSingleScore = localSingleMax;
        }

        if (localTemporalMax > maxScoreAtTimeStamp) {
          maxScoreAtTimeStamp = localTemporalMax;
        }

        return {
          date: date,
          values: values,
        };
      });

      let smallestDate = arrayData[0].date;
      let biggestDate = arrayData[arrayData.length - 1].date;

      //we must compute the critical time stamps where any 2 lines might intersect
      let criticalIndexes = getCriticalIndexes(arrayData.slice());

      return {
        categories: categories,
        maxSingleScore: maxSingleScore,
        maxScoreAtTimeStamp: maxScoreAtTimeStamp,
        values: arrayData,
        smallestDate: smallestDate,
        biggestDate: biggestDate,
        criticalIndexes: criticalIndexes,
      };
    }

    function getCriticalIndexes(values) {
      //the idea here is to get the indexes before any path could cross an other
      let valuesSorted = values.map((vs) => {
        let array = vs.values;
        let arrayExtended = array.map((value, index) => {
          return [value, index];
        });
        return arrayExtended.sort((b, a) => {
          return a[0] - b[0];
        });
      });
      let indexesBeforeChanges = [];
      let orderBeforeChanges = [];
      let orderAfterChanges = [];

      let previousOrder = valuesSorted[0].map((x) => {
        return x[1];
      });
      for (let i = 1; i < valuesSorted.length; i++) {
        let actualOrder = valuesSorted[i].map((x) => {
          return x[1];
        });

        if (!arraysEqual(actualOrder, previousOrder)) {
          indexesBeforeChanges.push(i - 1);
          orderBeforeChanges.push(previousOrder);
          orderAfterChanges.push(actualOrder);
        }

        previousOrder = actualOrder;
      } //end of for loop

      return {
        indexesBeforeChanges: indexesBeforeChanges,
        orderBeforeChanges: orderBeforeChanges,
        orderAfterChanges: orderAfterChanges,
      };
    }

    function pixelStepWidth(data, dateDisplayedInterval) {
      timeStampBetween2Values =
        data.values[1].date.getTime() - data.values[0].date.getTime();
      smallestTsOnScreen = dateDisplayedInterval[0].getTime();
      biggestTsOnscreen = dateDisplayedInterval[1].getTime();
      return pixelStepWidth2();
    }

    let smallestTsOnScreen = null;
    let biggestTsOnscreen = null;
    let timeStampBetween2Values = null;
    function pixelStepWidth2() {
      let timeIntervalDisplayed = biggestTsOnscreen - smallestTsOnScreen;
      let numberOfPointOnScreen =
        timeIntervalDisplayed / timeStampBetween2Values;
      return Math.min(3, Math.max(numberOfPointOnScreen / 30, 1));
    }

    function computeTimeStampsBreaks(
      lines,
      data,
      xScale,
      dateDisplayedInterval
    ) {
      //how much pixels separate two values on screen for the actual scale
      let pixelIntervalBetween2Dates =
        xScale(data.values[1].date) - xScale(data.values[0].date);
      let timeIntervalBetween2Dates =
        data.values[1].date.getTime() - data.values[0].date.getTime();
      let nbOfInterval = Math.max(
        2,
        Math.ceil(
          pixelIntervalBetween2Dates /
            pixelStepWidth(data, dateDisplayedInterval)
        )
      );

      //how big is an interval temporary
      let realStepWidth = timeIntervalBetween2Dates / nbOfInterval;
      //how many pixel represent an interval
      let delta_x = pixelIntervalBetween2Dates / nbOfInterval;

      const smallestTimeStamp = dateDisplayedInterval[0].getTime();
      const largestTimeStamp = dateDisplayedInterval[1].getTime();

      let actualOrder = data.criticalIndexes.orderBeforeChanges[0];
      let orderUntil = [];
      let afterMinDate = false;
      let beforeMaxDate = true;
      let maxLineLength = getMaxLengthOfLinesToConsider(lines, delta_x);

      data.criticalIndexes.indexesBeforeChanges.forEach((criticalIndex, i) => {
        let expectedFinalOrder = data.criticalIndexes.orderAfterChanges[i];
        let baseTemp = data.values[criticalIndex].date.getTime();
        for (var i = 1; i < nbOfInterval; i++) {
          if (!arraysEqual(expectedFinalOrder, actualOrder)) {
            let newTimeStamp = baseTemp + i * realStepWidth;
            if (newTimeStamp >= smallestTimeStamp) {
              afterMinDate = true;
            }
            if (newTimeStamp > largestTimeStamp) {
              beforeMaxDate = false;
            }
            if (afterMinDate && beforeMaxDate) {
              let orderAtT =
                nbOfInterval == 2
                  ? expectedFinalOrder
                  : getChartOrderNearTimeStamp(
                      lines,
                      maxLineLength,
                      newTimeStamp,
                      delta_x,
                      xScale
                    );

              if (!arraysEqual(orderAtT, actualOrder)) {
                orderUntil.push([actualOrder, newTimeStamp]);
                actualOrder = orderAtT;
              }
            }
          }
        }
        if (!arraysEqual(actualOrder, expectedFinalOrder) && beforeMaxDate) {
          if (afterMinDate) {
            //we missed something
            orderUntil.push([
              actualOrder,
              baseTemp + (nbOfInterval - 0) * realStepWidth,
            ]);
          }
          actualOrder = expectedFinalOrder;
        }
      });

      if (orderUntil.length == 0) {
        orderUntil.push([actualOrder, largestTimeStamp]);
      }

      if (orderUntil[orderUntil.length - 1][1] < largestTimeStamp) {
        orderUntil.push([actualOrder, largestTimeStamp]);
      }

      return orderUntil;
    }

    function getMaxLengthOfLinesToConsider(lines, delta_x) {
      let toReturn = [];
      lines.forEach((l) => {
        let path = l.upperPathElem;
        let totalLength = path.getTotalLength();
        let startJumpFromX = 0;
        let frontJumpLength = totalLength / 2;

        //let point0x = path.getPointAtLength(startJumpFromX).x
        let i = 0;
        while (i < 100 && frontJumpLength >= delta_x / 8) {
          let point1x = path.getPointAtLength(startJumpFromX + frontJumpLength)
            .x;
          let point2x = path.getPointAtLength(
            startJumpFromX + 2 * frontJumpLength
          ).x;
          if (point2x > point1x) {
            startJumpFromX += frontJumpLength;
          } else {
            frontJumpLength /= 2;
          }
          i++;
        }
        if (frontJumpLength >= delta_x / 8) {
          console.error("Did not converge");
        }
        toReturn.push(startJumpFromX);
      });
      return toReturn;
    }

    function computeChartInterLeaving(timeStampsBreaks) {
      //order until, order until, order until
      let numberOfCat = timeStampsBreaks[0][0].length;
      let chartInterLeaving = [];
      for (var n = 0; n < numberOfCat; n++) {
        let chartInterLeavingForThisNumber = [];
        let currentElem = timeStampsBreaks[0][0][n];
        for (var i = 1; i < timeStampsBreaks.length; i++) {
          let nextElement = timeStampsBreaks[i][0][n];
          if (nextElement != currentElem) {
            chartInterLeavingForThisNumber.push([
              currentElem,
              timeStampsBreaks[i - 1][1],
            ]);
            currentElem = nextElement;
          }
        }
        chartInterLeavingForThisNumber.push([
          currentElem,
          timeStampsBreaks[timeStampsBreaks.length - 1][1],
        ]);
        chartInterLeaving.push(chartInterLeavingForThisNumber);
      }
      return chartInterLeaving;
    }

    function arraysEqual(a, b) {
      if (a === b) return true;
      if (a == null || b == null) return false;
      if (a.length != b.length) return false;

      for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
      }
      return true;
    }

    function getChartOrderNearTimeStamp(
      lines,
      maxLineLength,
      timeStamp,
      delta_x,
      xScale
    ) {
      let toSort = [];
      let x = xScale(timeStamp);
      lines.forEach((line, indice) => {
        //let totalLength = line.upperPathElem.getTotalLength()
        let totalLength = maxLineLength[indice];
        toSort.push([
          line.id,
          getPointAtX(x, delta_x, 0, totalLength, line.upperPathElem, line.id)
            .y,
        ]);
      });
      toSort = toSort.sort((a, b) => {
        return a[1] - b[1];
      });

      let order = [];
      toSort.forEach((el) => {
        order.push(el[0]);
      });
      return order;
    }

    function getPointAtX(x, delta, minX, maxX, path, pathId) {
      let omin = minX;
      let omax = maxX;
      let middle = (maxX + minX) / 2;
      let lastMiddle = Number.MIN_VALUE;
      let middlePoint = path.getPointAtLength(middle);
      var i = 0;
      while (
        Math.abs(x - middlePoint.x) >= delta / 2 &&
        i < 30 &&
        Math.abs(lastMiddle - middle) >= delta / 2
      ) {
        if (middlePoint.x < x) {
          minX = middle;
        } else {
          maxX = middle;
        }
        lastMiddle = middle;
        middle = (minX + maxX) / 2;
        middlePoint = path.getPointAtLength(middle);
        i++;
      }
      if (Math.abs(x - middlePoint.x) > delta / 2) {
        console.error("Did not converged in " + i + " epoch");
        console.log("Computed y at :" + x + " for path nb " + pathId);
        console.log("with delta : " + delta);
        console.log("and min-max " + omin + "-" + omax);
        middle = (omax + omin) / 2;
        lastMiddle = Number.MIN_VALUE;
        middlePoint = path.getPointAtLength(middle);
        i = 0;
        while (
          Math.abs(x - middlePoint.x) >= delta / 2 &&
          i < 30 &&
          Math.abs(lastMiddle - middle) >= delta / 2
        ) {
          if (middlePoint.x < x) {
            minX = middle;
          } else {
            maxX = middle;
          }
          middle = (minX + maxX) / 2;
          middlePoint = path.getPointAtLength(middle);
          i++;
          lastMiddle = middle;
          console.log("-" + i + "-");
          console.log(middle + "->" + middlePoint.x);
          console.log("Target " + x);
        }
      }
      return middlePoint;
    }

    function getMaxValuesBetween(data, startDate, endDate, forCat) {
      let firstIndex = 0;
      let lastIndex = 0;

      while (
        lastIndex < data.values.length &&
        (data.values[firstIndex].date <= startDate ||
          data.values[lastIndex].date <= endDate)
      ) {
        if (data.values[firstIndex].date <= startDate) {
          firstIndex = firstIndex + 1;
        }
        if (data.values[lastIndex].date <= endDate) {
          lastIndex = lastIndex + 1;
        }
      }
      firstIndex = firstIndex - 1;
      lastIndex = lastIndex - 1;

      let maxSingleScore = Number.MIN_VALUE;
      let maxScoreAtTimeStamp = Number.MIN_VALUE;

      for (var i = firstIndex; i <= lastIndex; i++) {
        let values = data.values[i].values;
        let localSingleMax = values.reduce((a, b) => (a > b ? a : b), 0);
        let localTemporalMax = values.reduce((a, b) => a + b, 0);
        if (forCat != 0) {
          localSingleMax = values[forCat - 1];
          localTemporalMax = localSingleMax;
        }
        if (localSingleMax > maxSingleScore) {
          maxSingleScore = localSingleMax;
        }

        if (localTemporalMax > maxScoreAtTimeStamp) {
          maxScoreAtTimeStamp = localTemporalMax;
        }
      }
      return {
        maxSingleScore: maxSingleScore,
        maxScoreAtTimeStamp: maxScoreAtTimeStamp,
      };
    }

    function getClosestIndex(forDate, data) {
      if (forDate < data.values[0].date) {
        return 0;
      } else if (forDate > data.values[data.values.length - 1].date) {
        return data.values.length - 1;
      }

      let start = 0;
      let end = data.values.length - 1;
      while (start <= end) {
        let mid = Math.floor((start + end) / 2);

        if (data.values[mid].date < forDate) start = mid + 1;
        else end = mid - 1;
      }

      if (end < 0) return 0;
      let leftDate = data.values[end].date;
      let rightDate = data.values[start].date;

      let intervalBetweenCurentAndPrevious =
        forDate.getTime() - leftDate.getTime();
      let intervalBetweenCurentAndNext =
        rightDate.getTime() - forDate.getTime();
      return intervalBetweenCurentAndPrevious < intervalBetweenCurentAndNext
        ? end
        : start;
    }

    return {
      prepareData: prepareData,
      computeTimeStampsBreaks: computeTimeStampsBreaks,
      computeChartInterLeaving: computeChartInterLeaving,
      getMaxValuesBetween: getMaxValuesBetween,
      getClosestIndex: getClosestIndex,
      pixelStepWidth: pixelStepWidth2,
    };
  })();
  App.Plot1DataModel = Plot1DataModel;
  window.App = App;
})(window);
