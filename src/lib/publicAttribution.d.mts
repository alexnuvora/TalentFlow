export interface PublicAttribution {source_page:string;utm_source:string;utm_campaign:string}
export declare function publicSourcePath(path:unknown):string;
export declare function nextPublicAttribution(previous:PublicAttribution|null,pathname:string,search?:string,referrer?:string,origin?:string):PublicAttribution|null;
export declare function recordPublicVisit(pathname:string,search:string,referrer:string,origin:string):void;
export declare function getPublicAttribution(pathname:string,search:string,referrer:string,origin:string):PublicAttribution;
