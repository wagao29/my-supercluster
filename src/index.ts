type Cluster = {
  x: number;
  y: number;
  lastVisitedZoom: number;
  originalIndex: number;
  parentClusterId: number;
  numPoints: number;
};

type GeoJSONPoint = {
  type: string;
  id: any;
  properties: any;
  geometry: {
    type: string;
    coordinates: number[];
  };
};

type Options = {
  minZoom: number;
  maxZoom: number;
  minPoints: number;
  radius: number;
  extent: number;
  log: boolean;
};

const defaultOptions = {
  minZoom: 0,
  maxZoom: 16,
  minPoints: 2,
  radius: 40,
  extent: 512,
  log: false,
};

class Tree {
  clusters: Cluster[];

  constructor(clusters: Cluster[]) {
    this.clusters = clusters;
  }

  within(x: number, y: number, r: number): number[] {
    const res = [];
    for (let i = 0; i < this.clusters.length; i++) {
      const dx = this.clusters[i].x - x;
      const dy = this.clusters[i].y - y;
      if (dx * dx + dy * dy <= r * r) {
        res.push(i);
      }
    }
    return res;
  }

  range(minX: number, minY: number, maxX: number, maxY: number): number[] {
    const res = [];
    for (let i = 0; i < this.clusters.length; i++) {
      if (
        this.clusters[i].x >= minX &&
        this.clusters[i].y >= minY &&
        this.clusters[i].x <= maxX &&
        this.clusters[i].y <= maxY
      ) {
        res.push(i);
      }
    }
    return res;
  }
}

class Supercluster {
  options: Options;
  trees: Tree[];
  points: GeoJSONPoint[] = [];

  constructor(options: Options) {
    this.options = Object.assign(Object.create(defaultOptions), options);
    this.trees = new Array(this.options.maxZoom + 1);
  }

  load(points: GeoJSONPoint[]) {
    const { log, minZoom, maxZoom } = this.options;

    const loadStart = +Date.now();

    this.points = points;

    const clusters: Cluster[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (!p.geometry) continue;

      const [lng, lat] = p.geometry.coordinates;
      const x = Math.fround(lngX(lng));
      const y = Math.fround(latY(lat));
      clusters.push({
        x,
        y,
        lastVisitedZoom: Infinity,
        originalIndex: i,
        parentClusterId: -1,
        numPoints: 1,
      });
    }

    let tree = (this.trees[maxZoom + 1] = new Tree(clusters));

    if (log)
      console.log(
        `prepare ${points.length} points in ${+Date.now() - loadStart}ms`
      );

    for (let z = maxZoom; z >= minZoom; z--) {
      const now = +Date.now();

      tree = this.trees[z] = new Tree(this._cluster(tree, z));

      if (log)
        console.log(
          `z${z}: ${tree.clusters.length} clusters in ${+Date.now() - now}ms`
        );
    }

    if (log) console.log(`total: ${+Date.now() - loadStart}ms`);

    return this;
  }

  getClusters(bbox: number[], zoom: number): GeoJSONPoint[] {
    let minLng = ((((bbox[0] + 180) % 360) + 360) % 360) - 180;
    const minLat = Math.max(-90, Math.min(90, bbox[1]));
    let maxLng =
      bbox[2] === 180 ? 180 : ((((bbox[2] + 180) % 360) + 360) % 360) - 180;
    const maxLat = Math.max(-90, Math.min(90, bbox[3]));

    if (bbox[2] - bbox[0] >= 360) {
      minLng = -180;
      maxLng = 180;
    } else if (minLng > maxLng) {
      const easternHem = this.getClusters([minLng, minLat, 180, maxLat], zoom);
      const westernHem = this.getClusters([-180, minLat, maxLng, maxLat], zoom);
      return easternHem.concat(westernHem);
    }

    const tree = this.trees[this._limitZoom(zoom)];
    const ids = tree.range(
      lngX(minLng),
      latY(maxLat),
      lngX(maxLng),
      latY(minLat)
    );
    const clusters = tree.clusters;
    const res = [];
    for (const id of ids) {
      res.push(
        clusters[id].numPoints > 1
          ? getClusterJSON(clusters[id])
          : this.points[clusters[id].originalIndex]
      );
    }
    return res;
  }

  _limitZoom(z: number) {
    return Math.max(
      this.options.minZoom,
      Math.min(Math.floor(+z), this.options.maxZoom + 1)
    );
  }

  _cluster(tree: Tree, zoom: number): Cluster[] {
    const { radius, extent, minPoints } = this.options;

    const r = radius / (extent * Math.pow(2, zoom));
    const clusters = tree.clusters;
    const nextClusters: Cluster[] = [];

    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].lastVisitedZoom <= zoom) continue;
      clusters[i].lastVisitedZoom = zoom;

      const x = clusters[i].x;
      const y = clusters[i].y;
      const neighborIds = tree.within(clusters[i].x, clusters[i].y, r);

      const numPointsOrigin = clusters[i].numPoints;
      let numPoints = numPointsOrigin;

      for (const neighborId of neighborIds) {
        if (clusters[neighborId].lastVisitedZoom > zoom) {
          numPoints += clusters[neighborId].numPoints;
        }
      }

      if (numPoints > numPointsOrigin && numPoints >= minPoints) {
        let wx = x * numPointsOrigin;
        let wy = y * numPointsOrigin;

        const id = ((i | 0) << 5) + (zoom + 1) + this.points.length;

        for (const neighborId of neighborIds) {
          if (clusters[neighborId].lastVisitedZoom <= zoom) continue;
          clusters[neighborId].lastVisitedZoom = zoom;

          const numPoints2 = clusters[neighborId].numPoints;
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
          numPoints,
        });
      } else {
        nextClusters.push(clusters[i]);

        if (numPoints > 1) {
          for (const neighborId of neighborIds) {
            if (clusters[neighborId].lastVisitedZoom <= zoom) continue;
            clusters[neighborId].lastVisitedZoom = zoom;
            nextClusters.push(clusters[neighborId]);
          }
        }
      }
    }

    return nextClusters;
  }
}

function getClusterJSON(cluster: Cluster): GeoJSONPoint {
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

function getClusterProperties(cluster: Cluster): any {
  const count = cluster.numPoints;
  const abbrev =
    count >= 10000
      ? `${Math.round(count / 1000)}k`
      : count >= 1000
        ? `${Math.round(count / 100) / 10}k`
        : count;
  return {
    cluster: true,
    cluster_id: cluster.parentClusterId,
    point_count: count,
    point_count_abbreviated: abbrev,
  };
}

function lngX(lng: number) {
  return lng / 360 + 0.5;
}

function latY(lat: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - (0.25 * Math.log((1 + sin) / (1 - sin))) / Math.PI;
  return y < 0 ? 0 : y > 1 ? 1 : y;
}

function xLng(x: number) {
  return (x - 0.5) * 360;
}

function yLat(y: number) {
  const y2 = ((180 - y * 360) * Math.PI) / 180;
  return (360 * Math.atan(Math.exp(y2))) / Math.PI - 90;
}
