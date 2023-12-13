"use strict";
var defaultOptions = {
    minZoom: 0,
    maxZoom: 16,
    minPoints: 2,
    radius: 40,
    extent: 512,
    log: false,
};
var Tree = /** @class */ (function () {
    function Tree(clusters) {
        this.clusters = clusters;
    }
    Tree.prototype.within = function (x, y, r) {
        var res = [];
        for (var i = 0; i < this.clusters.length; i++) {
            var dx = this.clusters[i].x - x;
            var dy = this.clusters[i].y - y;
            if (dx * dx + dy * dy <= r * r) {
                res.push(i);
            }
        }
        return res;
    };
    Tree.prototype.range = function (minX, minY, maxX, maxY) {
        var res = [];
        for (var i = 0; i < this.clusters.length; i++) {
            if (this.clusters[i].x >= minX &&
                this.clusters[i].y >= minY &&
                this.clusters[i].x <= maxX &&
                this.clusters[i].y <= maxY) {
                res.push(i);
            }
        }
        return res;
    };
    return Tree;
}());
var Supercluster = /** @class */ (function () {
    function Supercluster(options) {
        this.points = [];
        this.options = Object.assign(Object.create(defaultOptions), options);
        this.trees = new Array(this.options.maxZoom + 1);
    }
    Supercluster.prototype.load = function (points) {
        var _a = this.options, log = _a.log, minZoom = _a.minZoom, maxZoom = _a.maxZoom;
        var totalNow = +Date.now();
        this.points = points;
        var clusters = [];
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            if (!p.geometry)
                continue;
            var _b = p.geometry.coordinates, lng = _b[0], lat = _b[1];
            var x = Math.fround(lngX(lng));
            var y = Math.fround(latY(lat));
            clusters.push({
                x: x,
                y: y,
                lastVisitedZoom: Infinity,
                originalIndex: i,
                parentClusterId: -1,
                numPoints: 1,
            });
        }
        var tree = (this.trees[maxZoom + 1] = new Tree(clusters));
        for (var z = maxZoom; z >= minZoom; z--) {
            var now = +Date.now();
            tree = this.trees[z] = new Tree(this._cluster(tree, z));
            if (log)
                console.log("z".concat(z, ": ").concat(tree.clusters.length, " clusters in ").concat(+Date.now() - now, "ms"));
        }
        if (log)
            console.log("total: ".concat(+Date.now() - totalNow, "ms"));
        return this;
    };
    Supercluster.prototype.getClusters = function (bbox, zoom) {
        var minLng = ((((bbox[0] + 180) % 360) + 360) % 360) - 180;
        var minLat = Math.max(-90, Math.min(90, bbox[1]));
        var maxLng = bbox[2] === 180 ? 180 : ((((bbox[2] + 180) % 360) + 360) % 360) - 180;
        var maxLat = Math.max(-90, Math.min(90, bbox[3]));
        if (bbox[2] - bbox[0] >= 360) {
            minLng = -180;
            maxLng = 180;
        }
        else if (minLng > maxLng) {
            var easternHem = this.getClusters([minLng, minLat, 180, maxLat], zoom);
            var westernHem = this.getClusters([-180, minLat, maxLng, maxLat], zoom);
            return easternHem.concat(westernHem);
        }
        var tree = this.trees[this._limitZoom(zoom)];
        var ids = tree.range(lngX(minLng), latY(maxLat), lngX(maxLng), latY(minLat));
        var clusters = tree.clusters;
        var res = [];
        for (var _i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
            var id = ids_1[_i];
            res.push(clusters[id].numPoints > 1
                ? getClusterJSON(clusters[id])
                : this.points[clusters[id].originalIndex]);
        }
        return res;
    };
    Supercluster.prototype._limitZoom = function (z) {
        return Math.max(this.options.minZoom, Math.min(Math.floor(+z), this.options.maxZoom + 1));
    };
    Supercluster.prototype._cluster = function (tree, zoom) {
        var _a = this.options, radius = _a.radius, extent = _a.extent, minPoints = _a.minPoints;
        var r = radius / (extent * Math.pow(2, zoom));
        var clusters = tree.clusters;
        var nextClusters = [];
        for (var i = 0; i < clusters.length; i++) {
            if (clusters[i].lastVisitedZoom <= zoom)
                continue;
            clusters[i].lastVisitedZoom = zoom;
            var x = clusters[i].x;
            var y = clusters[i].y;
            var neighborIds = tree.within(clusters[i].x, clusters[i].y, r);
            var numPointsOrigin = clusters[i].numPoints;
            var numPoints = numPointsOrigin;
            for (var _i = 0, neighborIds_1 = neighborIds; _i < neighborIds_1.length; _i++) {
                var neighborId = neighborIds_1[_i];
                if (clusters[neighborId].lastVisitedZoom > zoom) {
                    numPoints += clusters[neighborId].numPoints;
                }
            }
            if (numPoints > numPointsOrigin && numPoints >= minPoints) {
                var wx = x * numPointsOrigin;
                var wy = y * numPointsOrigin;
                var id = ((i | 0) << 5) + (zoom + 1) + this.points.length;
                for (var _b = 0, neighborIds_2 = neighborIds; _b < neighborIds_2.length; _b++) {
                    var neighborId = neighborIds_2[_b];
                    if (clusters[neighborId].lastVisitedZoom <= zoom)
                        continue;
                    clusters[neighborId].lastVisitedZoom = zoom;
                    var numPoints2 = clusters[neighborId].numPoints;
                    wx += clusters[neighborId].x * numPoints2;
                    wy += clusters[neighborId].y * numPoints2;
                    clusters[neighborId].parentClusterId = id;
                }
                clusters[i].parentClusterId = id;
                nextClusters.push({
                    x: wx / numPoints,
                    y: wy / numPoints,
                    lastVisitedZoom: Infinity,
                    originalIndex: id,
                    parentClusterId: -1,
                    numPoints: numPoints,
                });
            }
            else {
                nextClusters.push(clusters[i]);
                if (numPoints > 1) {
                    for (var _c = 0, neighborIds_3 = neighborIds; _c < neighborIds_3.length; _c++) {
                        var neighborId = neighborIds_3[_c];
                        if (clusters[neighborId].lastVisitedZoom <= zoom)
                            continue;
                        clusters[neighborId].lastVisitedZoom = zoom;
                        nextClusters.push(clusters[neighborId]);
                    }
                }
            }
        }
        return nextClusters;
    };
    return Supercluster;
}());
function getClusterJSON(cluster) {
    return {
        type: "Feature",
        id: cluster.parentClusterId,
        properties: getClusterProperties(cluster),
        geometry: {
            type: "Point",
            coordinates: [xLng(cluster.x), yLat(cluster.y)],
        },
    };
}
function getClusterProperties(cluster) {
    var count = cluster.numPoints;
    var abbrev = count >= 10000
        ? "".concat(Math.round(count / 1000), "k")
        : count >= 1000
            ? "".concat(Math.round(count / 100) / 10, "k")
            : count;
    return {
        cluster: true,
        cluster_id: cluster.parentClusterId,
        point_count: count,
        point_count_abbreviated: abbrev,
    };
}
function lngX(lng) {
    return lng / 360 + 0.5;
}
function latY(lat) {
    var sin = Math.sin((lat * Math.PI) / 180);
    var y = 0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI;
    return y < 0 ? 0 : y > 1 ? 1 : y;
}
function xLng(x) {
    return (x - 0.5) * 360;
}
function yLat(y) {
    var y2 = ((180 - y * 360) * Math.PI) / 180;
    return (360 * Math.atan(Math.exp(y2))) / Math.PI - 90;
}
//# sourceMappingURL=index.js.map