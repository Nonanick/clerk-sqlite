import {
  Archive,
  ComparableValues,
  IOrderBy,
  MaybePromise,
  QueryRequest,
  QueryResponse,
} from "clerk";
import { Database, OPEN_CREATE, OPEN_READWRITE, RunResult } from "sqlite3";
import { SQLiteArchiveTransaction } from "./transaction/SQLiteArchiveTransaction";
import { QueryParser } from "./query/QueryParser";

export class SQLiteArchive extends Archive {
  private database?: Database;

  constructor(
    private filename: string | ":memory:",
    private connectionMode: number = OPEN_CREATE | OPEN_READWRITE,
  ) {
    super();
  }

  isMemoryOnly() {
    return this.filename === ":memory:";
  }

  async connect() {
    return new Promise<Database>((resolve, reject) => {
      this.database = new Database(
        this.filename,
        this.connectionMode,
        ((err) => {
          if (err != null) {
            reject(err);
          }
          resolve(this.database!);
        }),
      );
    });
  }

  async connection(): Promise<Database> {
    if (this.database == null) {
      await this.connect();
    }

    return this.database!;
  }

  async query<T = any>(
    request: QueryRequest<T>,
  ): MaybePromise<QueryResponse<T>> {
    let parser = new QueryParser(request);

    let sql = parser.parse();

    //this.requestToSQL(request);

    let conn = await this.connection();

    let response = new QueryResponse(request);

    try {
      let values = await new Promise<any[]>(
        (resolve, reject) => {
          conn.run(
            sql.query,
            sql.params,
            function (err: Error) {
              if (err != null) {
                reject(err);
              }
              console.log("[SQLiteArchive] Result is", this);
              this.all((err, rows) => {
                if (err) {
                  reject(err);
                }

                resolve(rows);
              });
            },
          );
        },
      );

      if (Array.isArray(values)) {
        let rows: any[] = values;

        if (request.hasIncludes()) {
          rows = this.arrangeIncludedProperties(request, rows);
          rows = await this.fetchChildRows(request, rows);
        }
        response.addRows(...values);
      }
    } catch (err) {
      response.addErrors(err);
    }
    return response;
  }

  protected arrangeIncludedProperties(
    request: QueryRequest<any>,
    values: any[],
  ) {
    for (let includedProp of request.includes) {
      let relation = request.entity.properties[includedProp]?.getRelation();
      if (relation!.type !== "one-to-one" && relation!.type !== "many-to-one") {
        continue;
      }

      let baseName = `related_to_${includedProp}_`;
      let newValues = values.map((row) => {
        let newRow = { ...row };

        for (let rowPropertyName in row) {
          if (rowPropertyName.indexOf(baseName) === 0) {
            let newName = rowPropertyName.replace(baseName, "");
            let value = row[rowPropertyName];
            delete newRow[rowPropertyName];

            if (typeof newRow[includedProp] !== "object") {
              newRow[includedProp] = {};
            }

            newRow[includedProp][newName] = value;
          }
        }

        return newRow;
      });

      values = newValues;
    }
    return values;
  }

  protected async fetchChildRows(request: QueryRequest<any>, values: any[]) {
    for (let includedProp of request.includes) {
      let relation = request.entity.properties[includedProp]?.getRelation();
      if (relation == null) {
        continue;
      }

      // Fetch child rows applies only for many-to-one relations
      if (relation.type !== "many-to-one") {
        continue;
      }

      let store = request.entity.store();
      let childRequest = new QueryRequest(store.entity(relation.entity.name)!);
      let ordering: IOrderBy[] = [
        {
          property: relation?.property!,
          direction: "asc",
        },
      ];

      if (relation.order != null) {
        if (Array.isArray(relation.order)) {
          ordering.push(...relation.order);
        } else {
          ordering.push(relation.order);
        }
      }

      // Query for children whose parent was queried in the main query
      childRequest.loadQueryRequest({
        properties: relation?.returning,
        order: ordering,
        filters: {
          ...relation?.filters ?? {},
          "included-in-previous": [
            relation?.property!,
            "included in",
            values.map((m) => {
              return m[includedProp];
            }),
          ],
        },
      });

      const childRows = await childRequest.fetch();
      if (childRows instanceof Error || childRows == null) {
        console.error(
          "Failed to fetch associated child of property ",
          includedProp,
        );
        return values;
      }

      const placeInRowAt: {
        [index: number]: any;
      } = {};

      // Associate children to parent index
      for (let index = 0; index <= childRows.length; index++) {
        let child = childRows[index];
        for (let row of values) {
          if (child[relation.property] === row[includedProp]) {
            // Initialize array
            if (!Array.isArray(placeInRowAt[index])) placeInRowAt[index] = [];

            placeInRowAt[index].push(row);
            // Found its parent? stop!
            break;
          }
        }
      }

      for (let index in placeInRowAt) {
        values[index][includedProp] = placeInRowAt[index];
      }
    }

    return values;
  }

  transaction(): SQLiteArchiveTransaction {
    let trx = new SQLiteArchiveTransaction(this);

    return trx;
  }

  async lastInsertedId(): MaybePromise<any> {
    return await this.execute("SELECT last_inserted_id();");
  }

  async execute(query: string, params: ComparableValues[] = []) {
    return new Promise<RunResult>(async (resolve, reject) => {
      (await this.connection()).run(
        query,
        params,
        (result: RunResult, err: any) => {
          if (err != null) {
            reject(err);
          }
          resolve(result);
        },
      );
    });
  }
}

export type GeneratedQuerySQL = {
  query: string;
  params: any[];
};
