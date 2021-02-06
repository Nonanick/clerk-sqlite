import {
  IFilterQuery,
  MaybePromise,
  ComparableValues,
  IEntityProcedure,
  IEntityProcedureContext,
  IEntityProcedureResponse
} from 'clerk';
import { SQLiteArchive } from '../../SQLiteArchive';
import { FilterParser } from '../../query/FilterParser';

export const BatchUpdate: IEntityProcedure = {
  name: 'batch-update',
  execute: async (archive, request) => {

    if (!(archive instanceof SQLiteArchive)) {
      return new Error('Batch Update expects an MySQL archive!');
    }

    let updateSQL = `UPDATE \`${request.entity.source}\` `;

    const bindParams: any[] = [];
    const updateProperties: string[] = [];
    for (let propName in request.context.values) {
      let value = request.context.values[propName];
      updateProperties.push('`' + request.entity.source + '`.`' + propName + '` = ?');
      bindParams.push(value);
    }
    updateSQL += ' SET ' + updateProperties.join(' , ');

    let whereParams: { [name: string]: ComparableValues; } = {};
    let parsedFilter = FilterParser.ParseAll(request.context.filter, whereParams);
    let parsedWhere = FilterParser.ParseNamedAttributes(parsedFilter, whereParams);

    updateSQL += ' WHERE ' + parsedWhere.query;

    bindParams.push(...parsedWhere.params);

    let batchUpdateResponse = await archive.execute(updateSQL, bindParams);

    let response: IEntityProcedureResponse = {
      procedure: 'batch-update',
      request: request,
      success: batchUpdateResponse.changes > 0,
      bindedParams: bindParams,
      sql: updateSQL,
    };

    return response;
  }
};


export interface BatchUpdateContext extends IEntityProcedureContext {
  values: any;
  filter: IFilterQuery;
};

