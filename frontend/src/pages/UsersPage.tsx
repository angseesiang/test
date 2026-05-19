import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { createUser, disableUser, getUsers, removeUser, updateUser } from '../lib/api';
import { PublicUser } from '../types';
import { useAuth } from '../context/AuthContext';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(date));
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const data = await getUsers();
      setUsers(data.users);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load users.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addUser() {
    const name = prompt('New user full name');
    if (!name) return;
    const email = prompt('New user email address');
    if (!email) return;
    const password = prompt('Temporary password, at least 6 characters') ?? 'password';
    const role = (prompt('Role: admin or user', 'user') ?? 'user').toLowerCase() === 'admin' ? 'admin' : 'user';

    try {
      await createUser({ name, email, password, role });
      await load();
      setMessage('User added.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add user.');
    }
  }

  async function editUser(user: PublicUser) {
    const name = prompt('Full name', user.name);
    if (!name) return;
    const role = (prompt('Role: admin or user', user.role) ?? user.role).toLowerCase() === 'admin' ? 'admin' : 'user';

    try {
      await updateUser(user.id, { name, role });
      await load();
      setMessage('User updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update user.');
    }
  }

  async function toggleDisable(user: PublicUser) {
    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    if (!confirm(`${nextStatus === 'disabled' ? 'Disable' : 'Enable'} ${user.email}?`)) return;

    try {
      await disableUser(user.id, nextStatus);
      await load();
      setMessage(`User ${nextStatus}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to change user status.');
    }
  }

  async function deleteUser(user: PublicUser) {
    if (!confirm(`Remove ${user.email}? This cannot be undone.`)) return;

    try {
      await removeUser(user.id);
      await load();
      setMessage('User removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove user.');
    }
  }

  return (
    <div>
      <div className="pageHeader rowHeader usersHeader">
        <div>
          <h1>User Management</h1>
          <p>Manage access to the NIST AI RMF Advisor platform.</p>
        </div>
        <Button className="primary" onClick={addUser}>＋ Add User</Button>
      </div>

      {message && <div className="infoBox">{message}</div>}

      <div className="tableCard usersTableCard">
        <table className="dataTable">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>{user.id === currentUser?.id && <span className="muted"> (You)</span>}
                  <br />
                  <span className="muted">{user.email}</span>
                </td>
                <td><Badge label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'blue' : 'neutral'} /></td>
                <td><Badge label={user.status.toUpperCase()} tone={user.status === 'active' ? 'green' : 'red'} /></td>
                <td>{formatDate(user.joinedAt)}</td>
                <td>
                  <div className="actionGroup">
                    <button onClick={() => editUser(user)}>Edit</button>
                    <button onClick={() => toggleDisable(user)}>{user.status === 'active' ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => deleteUser(user)} disabled={user.id === currentUser?.id}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
