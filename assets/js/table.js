(function (window) {
  "use strict";
  var App = window.App || {};
  let Table = (function () {
    const bestVideosTable = new dc.DataTable("#table_container");
    const dateFormatParser = d3.timeParse("%Y-%m-%d");
    const dateFormat = d3.timeFormat("%x");
    const numberFormat = (number) =>
      d3.format(".4s")(number).replace(/G/, "Bn");

    // Data variables
    let topVideos = null;
    let all = null;
    let dateDimension = null;
    let categoryDimension = null;
    let viewCountDimension = null;

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

    d3.json("assets/data/top_videos.json", (data) => {
      data.forEach((d) => {
        d.date = dateFormatParser(d.date);
      });

      topVideos = crossfilter(data);
      all = topVideos.groupAll();
      dateDimension = topVideos.dimension((d) => d.date);
      categoryDimension = topVideos.dimension((d) => d.categories);
      viewCountDimension = topVideos.dimension((d) => d.view_count);

      initTable();
      dc.renderAll();
    });

    function initTable() {
      bestVideosTable
        .dimension(viewCountDimension)
        .columns([
          {
            label: "Date",
            format: (d) => dateFormat(d.date),
          },
          "categories",
          {
            label: "Views",
            format: (d) => numberFormat(d.view_count),
          },
          {
            label: "Video",
            format: (d) =>
              `<a href="https://www.youtube.com/watch?v=${d.display_id}"><img class="youtubeIcon" height="30px" src="assets/img/YouTube_icon.svg" alt="Video"></a>`,
          },
        ])
        .sortBy((d) => d.view_count)
        .order(d3.descending)
        .size(5)
        .on("renderlet", (table) => {
          table.selectAll(".dc-table-group").classed("info", true);
        });
    }

    function filterCategory(category) {
      if (!categoryDimension || category === selectedCategory) return;
      selectedCategory = category === null ? null : categories[category];
      categoryDimension.filter(selectedCategory);
      dc.redrawAll();
      return selectedCategory;
    }

    function filterDateRange(dateRange) {
      if (!dateDimension || dateRange === selectedTimeInterval) return;
      selectedTimeInterval = dateRange;
      dateDimension.filter(selectedTimeInterval);
      dc.redrawAll();
      return selectedTimeInterval;
    }

    return {
      filterCategory: filterCategory,
      filterDateRange: filterDateRange,
    };
  })();
  App.Table = Table;
  window.App = App;
})(window);
