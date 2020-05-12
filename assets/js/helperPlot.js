(function (window) {
  "use strict";
  var App = window.App || {};
  let HelperPlot = (function () {
    const dateFormatParser = d3.timeParse("%Y-%m-%d");
    const dateFormat = d3.timeFormat("%d-%m-%Y");
    const numberFormat = (number) =>
      d3.format(".4s")(number).replace(/G/, "Bn");

    // DOM element
    // const durationHist = new dc.BarChart("#durationHist");
    const containerName = "duration_plot";
    const svgWidth = document.getElementById(containerName).clientWidth;
    const svgHeight = document.getElementById(containerName).clientHeight;

    const margin = { top: 15, left: 70, right: 40, bottom: 40 },
      width = svgWidth - margin.left - margin.right,
      height = svgHeight - margin.top - margin.bottom;

    let svg = d3
      .select(`#${containerName}`)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    let tooltip = d3.select("body").append("div").attr("class", "tooltip");
    let durationHist = null;

    // Data variables
    let weeklyData = null;
    let all = null;
    let dateDimension = null;
    let categoryDimension = null;
    let viewCountDimension = null;
    let durationDimension = null;
    let durationGroup = null;

    // Filter variables
    const categories = [
      "Education, Science & Tech",
      "Entertainment",
      "Gaming",
      "Howto & Style",
      "Music",
      "News & Politics",
      "Others",
    ];
    let currentDate = null;
    let selectedTimeInterval = null;
    let selectedCategory = null;

    // equivalent for np.linspace
    const linspace = (startValue, stopValue, cardinality) => {
      var arr = [];
      var step = (stopValue - startValue) / (cardinality - 1);
      for (var i = 0; i < cardinality; i++) {
        arr.push(startValue + step * i);
      }
      return arr;
    };

    // equivalent for np.logspace in base 2 for our usecase !
    const logspace = (cardinality) => {
      var arr = [];
      for (var i = 0; i < cardinality; i++) {
        arr.push(2 ** i);
      }
      return arr;
    };

    d3.json("assets/data/weekly_data.json", (data) => {
      data.forEach((d) => {
        d.date = dateFormatParser(d.date);
      });

      console.log(data)

      const durationLength = data[0].duration.length;

      weeklyData = crossfilter(data);
      all = weeklyData.groupAll();
      dateDimension = weeklyData.dimension((d) => d.date);
      categoryDimension = weeklyData.dimension((d) => d.categories);
      durationGroup = all.reduce(
        (p, v) => {
          p.hist = p.hist.map((value, i) => value + v.duration[i]);
          return p;
        },
        (p, v) => {
          p.hist = p.hist.map((value, i) => value - v.duration[i]);
          return p;
        },
        () => ({
          hist: new Array(durationLength).fill(0),
          bins: linspace(0, 1800, durationLength + 1),
        })
      );

      durationHist = new DurationHist(durationGroup);
    });

    function filterCategory(category) {
      if (!categoryDimension || !durationHist || category === selectedCategory)
        return;
      selectedCategory = category === null ? null : categories[category];
      categoryDimension.filter(selectedCategory);
      durationHist.redraw();
      updateTitle();
      return selectedCategory;
    }

    function filterDateRange(dateRange) {
      if (!dateDimension || !durationHist || dateRange === selectedTimeInterval)
        return;
      selectedTimeInterval = dateRange;
      console.log(dateRange)
      dateDimension.filter(selectedTimeInterval);
      durationHist.redraw();
      updateTitle();
      return selectedTimeInterval;
    }

    function updateTitle() {
      let catText =
        selectedCategory === null ? "all categories" : selectedCategory;
      let timeText =
        selectedTimeInterval === null
          ? "for all time"
          : Array.isArray(selectedTimeInterval)
          ? `from ${dateFormat(selectedTimeInterval[0])} to ${dateFormat(
              selectedTimeInterval[1]
            )}`
          : `for ${dateFormat(selectedTimeInterval)}`;
      d3.select("#durationTitle").text(
        `Duration distribution of ${catText} videos ${timeText}`
      );
    }

    class DurationHist {
      constructor(group) {
        this.group = group;
        let { hist, bins } = group.value();
        this.x = d3
          .scaleLinear()
          .domain([d3.min(bins), d3.max(bins)])
          .range([0, width]);
        this.y = d3
          .scaleLinear()
          .domain([0, d3.max(hist)])
          .range([height, 0]);
        this.xAxis = d3.axisBottom(this.x);
        this.yAxis = d3.axisLeft(this.y).tickFormat(d3.format(".2s"));
        this.xAxisContainer = svg
          .append("g")
          .attr("class", "xAxis durationAxis")
          .attr("transform", "translate(0," + height + ")")
          .call(this.xAxis);

        this.yAxisContainer = svg
          .append("g")
          .attr("class", "yAxis durationAxis")
          .call(this.yAxis);

        svg
          .selectAll("rectangle")
          .data(hist)
          .enter()
          .append("rect")
          .attr("class", "rect durationRect")
          .attr("width", width / hist.length)
          .attr("height", (d) => height - this.y(+d))
          .attr("x", (d, i) => (width / hist.length) * i)
          .attr("y", (d) => this.y(+d))
          .on("mousemove", (d, i) =>
            tooltip
              .style("left", d3.event.pageX - 35 + "px")
              .style("top", d3.event.pageY - 60 + "px")
              .style("display", "inline-block")
              .html(`(${bins[i]} &ndash; ${bins[i + 1]})<br>${numberFormat(d)}`)
          )
          .on("mouseout", (d) => tooltip.style("display", "none"));

        //yAxisLabel
        svg
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 10 - margin.left)
          .attr("x", 0 - height / 2)
          .attr("dy", "1em")
          .style("text-anchor", "middle")
          .attr("class", "axisLabel")
          .text("Number of videos");

        //yAxisLabel
        svg
          .append("text")
          .attr(
            "transform",
            "translate(" + width / 2 + " ," + (height + margin.top + 20) + ")"
          )
          .style("text-anchor", "middle")
          .attr("class", "axisLabel")
          .text("Duration in seconds");
      }

      redraw() {
        let { hist, bins } = this.group.value();
        console.log(hist, bins)
        this.y.domain([0, d3.max(hist)]);
        this.yAxisContainer
          .transition()
          .duration(600)
          .call(this.yAxis.scale(this.y));
        let rects = svg.selectAll("rect").data(hist);
        rects.exit().remove();
        rects
          .transition()
          .duration(600)
          .attr("height", (d) => height - this.y(+d))
          // .attr("x", (d, i) => (width / hist.length) * i)
          .attr("y", (d) => this.y(+d));
      }
    }

    return {
      filterCategory: filterCategory,
      filterDateRange: filterDateRange,
    };
  })();
  App.HelperPlot = HelperPlot;
  window.App = App;
})(window);
