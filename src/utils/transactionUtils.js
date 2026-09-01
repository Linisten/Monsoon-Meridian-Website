import { supabase } from '../config/supabaseClient';

/**
 * Fetches all records from a Supabase table by paginating through range queries.
 * PostgREST / Supabase limits single query responses to 1000 rows by default.
 * This function loops using .range(from, to) until all rows are retrieved.
 *
 * @param {string} tableName - Supabase table name (e.g. 'sales', 'purchases')
 * @param {string} orderColumn - Column to order by (default 'created_at')
 * @param {boolean} ascending - Order direction (default false)
 * @param {string} selectClause - Select columns (default '*')
 * @param {Function} [filterFn] - Optional function to apply filters to query (e.g. q => q.gte('created_at', date))
 * @returns {Promise<Array>} - Array containing all records from the table
 */
export const fetchAllRecords = async (
  tableName,
  orderColumn = 'created_at',
  ascending = false,
  selectClause = '*',
  filterFn = null
) => {
  let allRecords = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from(tableName).select(selectClause);

    if (filterFn) {
      query = filterFn(query);
    }

    if (orderColumn) {
      query = query.order(orderColumn, { ascending });
    }

    const { data, error } = await query.range(from, to);

    if (error) {
      console.error(`Error fetching ${tableName} (page ${page}):`, error);
      break;
    }

    if (data && data.length > 0) {
      allRecords = [...allRecords, ...data];
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return allRecords;
};
