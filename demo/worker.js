/*global importScripts Supercluster */

importScripts("../dist/index.js");

const now = Date.now();

let index;

getJSON("../test/fixtures/places.json", (geojson) => {
  console.log(
    `loaded ${geojson.features.length} points JSON in ${
      (Date.now() - now) / 1000
    }s`
  );

  index = new Supercluster({
    log: true,
    radius: 60,
    extent: 256,
    maxZoom: 17,
  }).load(geojson.features);

  postMessage({ ready: true });
});

self.onmessage = function (e) {
  postMessage(index.getClusters(e.data.bbox, e.data.zoom));
};

function getJSON(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "json";
  xhr.setRequestHeader("Accept", "application/json");
  xhr.onload = function () {
    if (
      xhr.readyState === 4 &&
      xhr.status >= 200 &&
      xhr.status < 300 &&
      xhr.response
    ) {
      callback(xhr.response);
    }
  };
  xhr.send();
}
