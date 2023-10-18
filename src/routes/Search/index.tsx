import { Button } from "@arco-design/web-react";
import Directories from "./Directories";
import ExtensionFilter from "./ExtensionFilter";
import SearchFileTable from "./SearchFileTable";
import RegularFilters from "./RegularFilters";
import "./index.less";

/**
 * A page for searching files from a input directory
 * and adding multiple task from them
 */
export default function SearchPage() {
  const addTasks = () => {};

  return (
    <div className="container p-4 box-border h-screen flex basis-full flex-col">
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
          <Button type="primary" className="submit" onClick={addTasks}>
            Add Tasks
          </Button>
        </div>

        {/* Files Table */}
        <div className="flex-1 overflow-y-auto">
          <SearchFileTable />
        </div>
      </div>
    </div>
  );
}
