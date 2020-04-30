(function (window) {
  "use strict";
  var App = window.App || {};
  let Plot1DataModel = (function () {
    let pixelStepWidth = 3;

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
        Math.ceil(pixelIntervalBetween2Dates / pixelStepWidth)
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
              baseTemp + (nbOfInterval - 1) * realStepWidth,
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

    function getChartOrderNearTimeStamp(lines, timeStamp, delta_x, xScale) {
      let toSort = [];
      let x = xScale(timeStamp);
      lines.forEach((line) => {
        let totalLength = line.upperPathElem.getTotalLength();
        toSort.push([
          line.id,
          getPointAtX(x, delta_x, 0, totalLength, line.upperPathElem).y,
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

    function getPointAtX(x, delta, minX, maxX, path) {
      let middle = (maxX + minX) / 2;
      let middlePoint = path.getPointAtLength(middle);
      var i = 0;
      while (Math.abs(x - middlePoint.x) >= delta / 2 && i < 100) {
        if (middlePoint.x < x) {
          minX = middle;
        } else {
          maxX = middle;
        }
        middle = (minX + maxX) / 2;
        middlePoint = path.getPointAtLength(middle);
        i++;
      }
      return middlePoint;
    }

    function getMaxValuesBetween(data, startDate, endDate) {
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

    return {
      prepareData: prepareData,
      computeTimeStampsBreaks: computeTimeStampsBreaks,
      computeChartInterLeaving: computeChartInterLeaving,
      getMaxValuesBetween: getMaxValuesBetween,
    };
  })();
  App.Plot1DataModel = Plot1DataModel;
  window.App = App;
})(window);
