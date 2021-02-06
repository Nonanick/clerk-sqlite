import {  IEntityProcedure } from 'clerk';

export const CreateForeignRelation : IEntityProcedure = {
  name : 'create-foreign-relation',
  execute : async (archive, request) => {

    return {
      name : request.entity.name,
      procedure : CreateForeignRelation.name,
      request,
      success : true,
    };
  }
}