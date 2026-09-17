export async function requireFeature(db:any,companyId:string,feature:string){
 const {data,error}=await db.rpc('workspace_feature_enabled',{p_company:companyId,p_feature:feature});
 if(error||data!==true)throw new Error('This feature requires an active subscription that includes it');
}
