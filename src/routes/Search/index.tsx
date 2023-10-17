import { Button } from "@arco-design/web-react";
import Directories from "./Directories";
import ExtensionFilter from "./ExtensionFilter";
import TargetTable from "./FileTable";
import RegularFilters from "./RegularFilters";
import "./index.less";

/**
 * A page for searching files from a input directory
 * and adding multiple task from them
 */
export default function SearchPage() {
  return (
    <div className="container p-4 box-border h-screen flex flex-col">
      {/* Input & Output Directories Selector */}
      <Directories />

      <div className="flex-1 overflow-y-hidden flex">
        <div className="mr-4 basis-96 flex flex-col">
          {/* Extensions Filter */}
          <ExtensionFilter />

          {/* Regular Filters */}
          <div className="flex-1 overflow-y-hidden">
            <RegularFilters />
          </div>

          {/* Submit */}
          <Button type="primary" className="submit">
            Add Tasks
          </Button>
        </div>

        {/* Files Table */}
        <div className="flex-1 overflow-y-auto">
          <TargetTable />
        </div>
      </div>
    </div>
  );
}
