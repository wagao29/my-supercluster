/*global importScripts Supercluster */

importScripts("./index.js");

let index;

const option = {
  log: true,
  radius: 60,
  extent: 256,
  maxZoom: 17,
};

self.onmessage = function (e) {
  if (e.data.numPoints) {
    index = new Supercluster(option).load(
      generateGeoJSONPoints(e.data.numPoints)
    );
    postMessage({ ready: true });
  } else {
    postMessage(index.getClusters(e.data.bbox, e.data.zoom));
  }
};

function generateGeoJSONPoints(numPoints) {
  const geoJsonPoints = [];
  for (let i = 0; i < numPoints; i++) {
    const json = {
      type: "Feature",
      id: i,
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [Math.random() * 360 - 180, Math.random() * 180 - 90],
      },
    };
    geoJsonPoints.push(json);
  }
  return geoJsonPoints;
}

console.log = (...args) => {
  postMessage({ log: args });
};
