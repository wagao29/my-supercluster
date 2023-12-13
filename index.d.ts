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
declare const defaultOptions: {
    minZoom: number;
    maxZoom: number;
    minPoints: number;
    radius: number;
    extent: number;
    log: boolean;
};
declare class Tree {
    clusters: Cluster[];
    constructor(clusters: Cluster[]);
    within(x: number, y: number, r: number): number[];
    range(minX: number, minY: number, maxX: number, maxY: number): number[];
}
declare class Supercluster {
    options: Options;
    trees: Tree[];
    points: GeoJSONPoint[];
    constructor(options: Options);
    load(points: GeoJSONPoint[]): this;
    getClusters(bbox: number[], zoom: number): GeoJSONPoint[];
    _limitZoom(z: number): number;
    _cluster(tree: Tree, zoom: number): Cluster[];
}
declare function getClusterJSON(cluster: Cluster): GeoJSONPoint;
declare function getClusterProperties(cluster: Cluster): any;
declare function lngX(lng: number): number;
declare function latY(lat: number): number;
declare function xLng(x: number): number;
declare function yLat(y: number): number;
