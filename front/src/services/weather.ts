import {backend,queryString} from './backend'
export interface Weather {
 temperature?:number|null;condition?:string;humidity?:number|null;rainfall?:number|null;windSpeed?:number|null;observedAt?:string;source?:string;
 hourly?:{time:string;temperature?:number;rainfall?:number}[]
}
export async function getWeather(lat:number,lng:number,signal?:AbortSignal){
 const data=await backend<Weather>('/api/navigation/weather'+queryString({lat,lng}),{signal})
 if(!data||![data.temperature,data.humidity,data.rainfall].some(value=>typeof value==='number'&&Number.isFinite(value)))throw new Error('기상청 관측 정보를 받아오지 못했습니다.')
 return data
}
