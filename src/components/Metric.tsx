import { Card } from './Ui';
export function Metric({label,value,detail}:{label:string;value:string|number;detail?:string}){return <Card className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>{detail&&<div className="metric-detail">{detail}</div>}</Card>}
