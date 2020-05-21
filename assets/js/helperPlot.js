(function (window) {
  "use strict";
  var App = window.App || {};
  let HelperPlot = (function () {
    const dateFormatParser = d3.timeParse("%Y-%m-%d");
    const dateFormat = d3.timeFormat("%d-%m-%Y");
    const numberFormat = (number) =>
      d3.format(".4s")(number).replace(/G/, "Bn");
    const powFormat = (number) =>
      number <= 1024 ? number : d3.format(".3s")(number).replace(/G/, "Bn");

    // DOM element for helper plot 1
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

    // DOM element for helper plot 2
    const container2Name = "hist_plot";
    const svg2Width = document.getElementById(container2Name).clientWidth;
    const svg2Height = document.getElementById(container2Name).clientHeight;
    const width2 = svg2Width - margin.left - margin.right,
      height2 = svg2Height - margin.top - margin.bottom;
    let svg2 = d3
      .select(`#${container2Name}`)
      .append("svg")
      .attr("width", width2 + margin.left + margin.right)
      .attr("height", height2 + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    let countHist = null;

    // Data variables
    let weeklyData = null;
    let all = null;
    let dateDimension = null;
    let categoryDimension = null;
    let durationGroup = null;
    let viewCountGroup = null;
    let likeCountGroup = null;
    let dislikeCountGroup = null;

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

    const powerOfTwo = (d) => d / Math.pow(2, Math.ceil(Math.log2(d))) === 1;

    function getGroup(data, field, len, bins) {
      return data.groupAll().reduce(
        (p, v) => {
          p.hist = p.hist.map((value, i) => value + v[field][i]);
          return p;
        },
        (p, v) => {
          p.hist = p.hist.map((value, i) => value - v[field][i]);
          return p;
        },
        () => ({
          hist: new Array(len).fill(0),
          bins: bins,
        })
      );
    }

    d3.json("assets/data/weekly_data.json", (data) => {
      data.forEach((d) => {
        d.date = dateFormatParser(d.date);
      });

      //console.log(data)

      const durationLength = data[0].duration.length;
      const viewCountLength = data[0].view_count.length;
      const likeCountLength = data[0].like_count.length;
      const dislikeCountLength = data[0].dislike_count.length;

      weeklyData = crossfilter(data);
      dateDimension = weeklyData.dimension((d) => d.date);
      categoryDimension = weeklyData.dimension((d) => d.categories);
      durationGroup = getGroup(
        weeklyData,
        "duration",
        durationLength,
        linspace(0, 1800, durationLength + 1)
      );
      viewCountGroup = getGroup(
        weeklyData,
        "view_count",
        viewCountLength,
        logspace(viewCountLength + 1)
      );
      likeCountGroup = getGroup(
        weeklyData,
        "like_count",
        likeCountLength,
        logspace(likeCountLength + 1)
      );
      dislikeCountGroup = getGroup(
        weeklyData,
        "dislike_count",
        dislikeCountLength,
        logspace(dislikeCountLength + 1)
      );
      durationHist = new DurationHist(durationGroup);
      countHist = new CountHist([
        viewCountGroup,
        likeCountGroup,
        dislikeCountGroup,
      ]);
    });

    function filterCategory(category) {
      if (!categoryDimension || !durationHist || category === selectedCategory)
        return;
      selectedCategory = category === null ? null : categories[category];
      categoryDimension.filter(selectedCategory);
      durationHist.redraw();
      countHist.redraw();
      updateTitle();
      return selectedCategory;
    }

    function filterDateRange(dateRange) {
      if (!dateDimension || !durationHist || dateRange === selectedTimeInterval)
        return;
      selectedTimeInterval = dateRange;
      //console.log(dateRange)
      dateDimension.filter(selectedTimeInterval);
      durationHist.redraw();
      countHist.redraw();
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
        `Duration of ${catText} videos ${timeText}`
      );
      d3.select("#countTitle").text(
        ` of ${catText} videos ${timeText}`
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

        //xAxisLabel
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
        //console.log(hist, bins)
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

    const superscript = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    const formatLog2Ticks = (d) => {
      d = Math.log2(d);
      let units = d % 10;
      let tens = (d - units) / 10;
      return `2${
        d < 10 ? superscript[units] : superscript[tens] + superscript[units]
      }`;
    };

    class CountHist {
      constructor(groups) {
        this.groups = groups;
        this.xlabel = ["Views Count", "Likes Count", "Dislike Count"];
        this.index = 0;
        let { hist, bins } = this.groups[this.index].value();
        this.x = d3
          .scaleLog()
          .base(2)
          .domain([d3.min(bins), d3.max(bins)])
          .range([0, width2]);
        this.y = d3
          .scaleLinear()
          .domain([0, d3.max(hist)])
          .range([height2, 0]);
        this.xAxis = d3.axisBottom(this.x).tickFormat(formatLog2Ticks);
        this.yAxis = d3.axisLeft(this.y).tickFormat(d3.format(".2s"));

        this.xAxisContainer = svg2
          .append("g")
          .attr("class", "xAxis countAxis")
          .attr("transform", "translate(0," + height2 + ")")
          .call(this.xAxis);
        // .selectAll(".tick text")
        // .text(null)
        // .filter(powerOfTwo)
        // .text(2)
        // .append("tspan")
        // .attr("dy", "-.7em")
        // .text(function (d) {
        //   return Math.round(Math.log2(d));
        // });

        this.yAxisContainer = svg2
          .append("g")
          .attr("class", "yAxis countAxis")
          .call(this.yAxis);

        svg2
          .selectAll("rectangle")
          .data(hist)
          .enter()
          .append("rect")
          .attr("class", "rect countRect")
          .attr("width", width2 / hist.length)
          .attr("height", (d) => height2 - this.y(+d))
          .attr("x", (d, i) => (width2 / hist.length) * i)
          .attr("y", (d) => this.y(+d))
          .on("mousemove", (d, i) =>
            tooltip
              .style("left", d3.event.pageX - 35 + "px")
              .style("top", d3.event.pageY - 60 + "px")
              .style("display", "inline-block")
              .html(
                `(${powFormat(bins[i])} &ndash; ${powFormat(
                  bins[i + 1]
                )})<br>${numberFormat(d)}`
              )
          )
          .on("mouseout", (d) => tooltip.style("display", "none"));

        //yAxisLabel
        svg2
          .append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", 10 - margin.left)
          .attr("x", 0 - height2 / 2)
          .attr("dy", "1em")
          .style("text-anchor", "middle")
          .attr("class", "axisLabel")
          .text("Number of videos");

        //xAxisLabel
        svg2
          .append("text")
          .attr(
            "transform",
            "translate(" + width2 / 2 + " ," + (height2 + margin.top + 20) + ")"
          )
          .style("text-anchor", "middle")
          .attr("class", "axisLabel")
          .attr("id", "xAxisLabelCountPlot")
          .text(this.xlabel[this.index]);

        let that = this;
        d3.select("#countSelect").on("change", function () {
          that.setIndex(+this.value);
        });
      }

      redraw(updateX = false) {
        let { hist, bins } = this.groups[this.index].value();
        //console.log(hist, bins)
        this.y.domain([0, d3.max(hist)]);
        this.yAxisContainer
          .transition()
          .duration(600)
          .call(this.yAxis.scale(this.y));
        if (updateX) {
          this.x.domain([d3.min(bins), d3.max(bins)]);
          this.xAxisContainer
            .transition()
            .duration(600)
            .call(this.xAxis.scale(this.x));
          d3.select("#xAxisLabelCountPlot").text(this.xlabel[this.index]);
        }
        let rects = svg2.selectAll("rect").data(hist);
        rects.exit().remove();
        rects
          .transition()
          .duration(600)
          .attr("height", (d) => height2 - this.y(+d))
          .attr("x", (d, i) => (width2 / hist.length) * i)
          .attr("width", width2 / hist.length)
          .attr("y", (d) => this.y(+d));
      }

      setIndex(index) {
        if (this.index !== index) {
          this.index = index;
          this.redraw(true);
        }
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
