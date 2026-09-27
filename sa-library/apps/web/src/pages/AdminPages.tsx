import { Link, NavLink } from 'react-router-dom';
import { useResource } from '@/hooks/useResource';
import { PageTitle, ResourceState, DataForm, compact } from '@/components/common/UI';
import { send } from '@/services/api';
import type { Library } from '@/types/api';
function AdminNav() {
  return (
    <nav className="tabs" aria-label="Admin navigation">
      <NavLink to="/admin" end>
        Overview
      </NavLink>
      <NavLink to="/admin/libraries">Libraries & branches</NavLink>
    </nav>
  );
}
export function AdminPage() {
  const totals = useResource<Record<string, number>>('/admin/totals');
  return (
    <>
      <PageTitle title="Platform overview" eyebrow="PLATFORM ADMINISTRATION" />
      <AdminNav />
      <ResourceState resource={totals} />
      <div className="stats-grid">
        {Object.entries(totals.data ?? {}).map(([key, value]) => (
          <article className="panel stat" key={key}>
            <p>{key.replace(/([A-Z])/g, ' $1')}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <Link className="button" to="/admin/libraries">
        Manage libraries
      </Link>
    </>
  );
}
export function AdminLibrariesPage() {
  const libraries = useResource<Library[]>('/admin/libraries');
  return (
    <>
      <PageTitle title="Libraries & branches" eyebrow="PLATFORM ADMINISTRATION" />
      <AdminNav />
      <div className="split-forms">
        <details className="panel">
          <summary>Create a library</summary>
          <DataForm
            fields={[
              { name: 'name', label: 'Library name', required: true },
              { name: 'municipality', label: 'Municipality', required: true },
              { name: 'province', label: 'Province', required: true },
              { name: 'website', label: 'Website', type: 'url' },
            ]}
            label="Create library"
            submit={(data) => send('/admin/libraries', 'POST', compact(data))}
            onDone={libraries.reload}
            reset
          />
        </details>
        <details className="panel">
          <summary>Create a branch</summary>
          <DataForm
            key={libraries.data?.length}
            fields={[
              {
                name: 'libraryId',
                label: 'Library',
                type: 'select',
                required: true,
                options: libraries.data?.map((l) => ({ value: l.id, label: l.name })),
              },
              { name: 'name', label: 'Branch name', required: true },
              { name: 'address', label: 'Street address', required: true },
              { name: 'city', label: 'City', required: true },
              { name: 'province', label: 'Province', required: true },
              { name: 'postalCode', label: 'Postal code' },
              { name: 'phone', label: 'Phone' },
              { name: 'email', label: 'Email', type: 'email' },
            ]}
            label="Create branch"
            submit={(data) => {
              const { libraryId, ...branch } = data;
              return send(`/admin/libraries/${libraryId}/branches`, 'POST', compact(branch));
            }}
            onDone={libraries.reload}
            reset
          />
        </details>
      </div>
      <ResourceState resource={libraries} />
      {libraries.data?.map((library) => (
        <section key={library.id} className="panel">
          <h2>{library.name}</h2>
          <p>
            {library.municipality}, {library.province}
          </p>
          <div className="branch-grid">
            {library.branches.map((branch) => (
              <article key={branch.id}>
                <h3>{branch.name}</h3>
                <p>{branch.address}</p>
                <p>
                  {branch.city}, {branch.province}
                </p>
              </article>
            ))}
          </div>
          {!library.branches.length && <p>No branches yet. Create the first branch above.</p>}
        </section>
      ))}
    </>
  );
}
