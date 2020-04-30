# YouTube Longitudinal Data Visualization

Welcome in the github pages repository of our YouTube visualization project. Our aim is to provide an interactive visualization of about 96 mio YouTube videos from english channels with more than 10k subscribers. This project was made for the [COM-480 Data visualization](https://edu.epfl.ch/coursebook/en/data-visualization-COM-480) class at EPFL in Spring 2020. You can find more information about our preprocessing and milestones in the [class repository](https://github.com/com-480-data-visualization/com-480-project-datavirus/). Our results are presented [here](https://tvaucher.github.io/youtube-viz/)

## Setup

Like most GitHub pages, our website is built using [Jekyll v4](https://jekyllrb.com/). So in order to build the website locally, you need `Ruby >= 2.4.0` to be installed. You can follow the [Installation guides](https://jekyllrb.com/docs/installation/#guides) from Jekyll if you don't have ruby. After that, download the repository and move into the repository folder.

Then run the following commands:

```bash
gem install jekyll bundler
bundle install
```

This will download Jekyll and the necessary plugins to run our website

### Development

To serve the website locall, run `bundle exec jekyll serve`. This will launch a page at [http://localhost:4000](http://localhost:4000). Jekyll automatically watch for changes so you simply need to refresh the page when you make modifications

### Deployment

Just commit and push to your repository. If it's the first time, you also need to tell GitHub to [serve pages from you repository](https://help.github.com/en/github/working-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
