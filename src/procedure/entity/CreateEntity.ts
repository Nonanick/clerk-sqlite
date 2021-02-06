import { IEntityProcedure } from "clerk";
import { SQLiteArchive } from "../../SQLiteArchive";

export const CreateEntity: IEntityProcedure = {
  name: "create-entity",
  execute: async (archive, req) => {
    if (!(archive instanceof SQLiteArchive)) {
      return new Error("Create Entity expects and SQLite Archive!");
    }

    const tableName = req.entity.name;
    const propertiesSQL: string[] = [];

    for (let [name, propInfo] of Object.entries(req.entity.properties)) {
      propertiesSQL.push(
        ` ${name} ${
          // SQLite Types:
          getSQLiteRawDataType(propInfo.getType().raw.name)
        }  ${
          // SQLite is Primary Key
          req.entity.identifier.name === name ? "PRIMARY KEY" : ""
        } ${
          // Required == NOT NULL
          propInfo.isRequired() ? "NOT NULL" : ""
        } `,
      );
    }

    const statement: string = `CREATE TABLE IF NOT EXISTS ${tableName} ( 
      ${propertiesSQL.join(",\n\t")}
    )`;

    console.log("Will now create table with statement:\n", statement);
    try {
      await (await archive.connection()).exec(statement);
      return {
        name: req.entity.name,
        procedure: CreateEntity.name,
        request: req,
        success: true,
      };
    } catch (err) {
      console.error("Failed to create table!", err);
    }
    return {
      name: req.entity.name,
      procedure: CreateEntity.name,
      request: req,
      success: false,
    };
  },
};

function getSQLiteRawDataType(type: string) {
  switch (type) {
    case "String":
      return "TEXT";
    case "Number":
      return "REAL";
    case "Boolean":
      return "INTEGER";
    default:
      return "TEXT";
  }
}
