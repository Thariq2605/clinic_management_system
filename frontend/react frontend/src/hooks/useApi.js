import {useEffect,useState} from 'react';
import {apiError} from '../services/api';
export function useApi(loader,deps=[]){const [state,setState]=useState({loading:true,error:'',data:null});useEffect(()=>{let active=true;setState(current=>({...current,loading:true,error:''}));loader().then(data=>active&&setState({loading:false,error:'',data})).catch(error=>active&&setState({loading:false,error:apiError(error),data:null}));return()=>{active=false}},deps);return state;}
