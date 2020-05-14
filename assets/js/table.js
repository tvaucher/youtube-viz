(function (window) {
  "use strict";
  var App = window.App || {};
  let Table = (function () {
    const dateFormatParser = d3.timeParse("%Y-%m-%d");
    const dateFormat = d3.timeFormat("%d-%m-%Y");
    const numberFormat = (number) =>
      d3.format(".4s")(number).replace(/G/, "Bn");
    const hhmmss = (secs) => {
      let minutes = Math.floor(secs / 60);
      secs = secs % 60;
      const hours = Math.floor(minutes / 60);
      minutes = minutes % 60;
      return hours > 0
        ? `${hours}h ${minutes}min ${secs}sec`
        : minutes > 0
        ? `${minutes}min ${secs}sec`
        : `${secs}sec`;
    };
    // DOM element
    const bestVideosTable = new dc.DataTable("#dcTable");

    // Data variables
    let topVideos = null;
    let all = null;
    let dateDimension = null;
    let categoryDimension = null;
    let viewCountDimension = null;
    let showTable = false;
    document.getElementById("showTable").addEventListener("click", () => {
      showTable = !showTable;
      if (showTable) {
        updateTitle();
        bestVideosTable.redraw();
        initEmbedVid();
      }
    });

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
        d.upload_date = dateFormatParser(d.upload_date);
        d.thumbnail = `<a class="showVideoOnClick" data-song-id=${
          d.display_id
        } data-upload-timestamp=${d.date.getTime()}>
        <img class="thumbnail" height="70px" src="https://i.ytimg.com/vi/${
          d.display_id
        }/mqdefault.jpg" alt="Video">
        <span class="videoTitle">${d.title}</span>
        </a>`;
      });

      topVideos = crossfilter(data);
      all = topVideos.groupAll();
      dateDimension = topVideos.dimension((d) => d.date);
      categoryDimension = topVideos.dimension((d) => d.categories);
      viewCountDimension = topVideos.dimension((d) => d.view_count);

      initTable();
      //
      bestVideosTable.render();
      initEmbedVid();
    });

    function initTable() {
      bestVideosTable
        .dimension(viewCountDimension)
        .columns([
          {
            label: "Rank",
            format: (d) => '<span class="counterCell"></span>',
          },
          {
            label: "Date",
            format: (d) => dateFormat(d.upload_date),
          },
          {
            label: "Video",
            format: (d) => d.thumbnail,
          },
          {
            label: "Category",
            format: (d) => d.categories,
          },
          {
            label: "Views",
            format: (d) => numberFormat(d.view_count),
          },
          {
            label: "Likes",
            format: (d) => numberFormat(d.like_count),
          },
          {
            label: "Dislikes",
            format: (d) => numberFormat(d.dislike_count),
          },
          {
            label: "Duration",
            format: (d) => hhmmss(d.duration),
          },
        ])
        .sortBy((d) => d.view_count)
        .order(d3.descending)
        .size(50)
        .on("renderlet", (table) => {
          table.selectAll(".dc-table-group").classed("info", true);
        });
    }

    function initEmbedVid() {
      let divs = document.getElementsByClassName("showVideoOnClick");
      Array.prototype.forEach.call(divs, function (d) {
        d.addEventListener("click", function (e) {
          let songId = d.getAttribute("data-song-id");
          event.preventDefault();
          e.stopPropagation();
          App.YoutubePlayer.makeAppearYoutubePlayerBox(songId);
        });
        d.addEventListener("mousemove", function (e) {
          let uploadTS = +d.getAttribute("data-upload-timestamp");
          App.Plot1.updateVerticalLineInUI(uploadTS);
        });
      });
    }

    function filterCategory(category) {
      if (!categoryDimension || category === selectedCategory) return;
      selectedCategory = category === null ? null : categories[category];
      categoryDimension.filter(selectedCategory);
      updateTitle();
      bestVideosTable.redraw();
      initEmbedVid();
      return selectedCategory;
    }

    function filterDateRange(dateRange) {
      if (!dateDimension || dateRange === selectedTimeInterval) return;
      selectedTimeInterval = dateRange;
      dateDimension.filter(selectedTimeInterval);
      if (showTable) {
        updateTitle();
        bestVideosTable.redraw();
        initEmbedVid();
      }
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
      d3.select("#tableTitle").text(`Top 50 ${catText} videos ${timeText}`);
    }

    return {
      filterCategory: filterCategory,
      filterDateRange: filterDateRange,
    };
  })();
  App.Table = Table;
  window.App = App;
})(window);
