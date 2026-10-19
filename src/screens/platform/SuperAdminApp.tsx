import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { LogOut } from '../../icons';
import { pop } from '../../pop';
import { industryLabel } from '../../industry';
import { AppShell, AppearanceSettings, Btn, Header, ScrollBody } from '../../ui';
import { colors } from '../../theme';

type OwnerRow = {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerified: boolean;
  companyName: string | null;
  companyType: 'GYM' | 'BARBER' | null;
  createdAt: string;
  gymId?: number | null;
  shopId?: number | null;
  memberOrStaffCount?: number;
};

export function SuperAdminApp() {
  const { token, logout } = useAuth();
  const [rows, setRows] = useState<OwnerRow[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OwnerRow | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api<OwnerRow[]>('/platform/owners', { token })
      .then(setRows)
      .catch((e) => pop.err(e))
      .finally(() => setBusy(false));
  }, [token]);

  async function open(id: number) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    try {
      setDetail(await api<OwnerRow>(`/platform/owners/${id}`, { token }));
    } catch (e) {
      pop.err(e);
    }
  }

  return (
    <AppShell>
      <Header title="Owners" subtitle={`${rows.length} accounts`} brand />
      <ScrollBody>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : rows.length === 0 ? (
          <Text className="text-[13px] text-muted">No owner accounts yet.</Text>
        ) : (
          rows.map((r) => (
            <Pressable key={r.id} onPress={() => open(r.id)} className="mb-sm rounded-md border border-border bg-surface p-md">
              <Text className="text-[15px] font-bold text-ink">{r.companyName || 'No company yet'}</Text>
              <Text className="mt-0.5 text-[13px] text-muted">
                {r.name} · {r.email}
              </Text>
              <Text className="mt-0.5 text-[12px] text-muted">
                {industryLabel(r.companyType)} · {r.status}
                {r.emailVerified ? '' : ' · email unverified'}
              </Text>
              {openId === r.id && detail ? (
                <View className="mt-sm border-t border-border pt-sm">
                  <Text className="text-[12px] text-muted">
                    {detail.companyType === 'GYM'
                      ? `${detail.memberOrStaffCount ?? 0} members`
                      : detail.companyType === 'BARBER'
                        ? `${detail.memberOrStaffCount ?? 0} staff`
                        : 'Waiting on company setup'}
                  </Text>
                  <Text className="mt-1 text-[12px] text-muted">
                    Joined {new Date(detail.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))
        )}
        <AppearanceSettings />
        <Btn label="Sign out" variant="ghost" icon={LogOut} onPress={logout} />
      </ScrollBody>
    </AppShell>
  );
}
