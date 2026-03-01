import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';

export const useFeatureRequestDialog = ({
  sessionUser,
  activeTab,
  moduleConfig,
  selectedSeason,
  selectedTeam,
  selectedSeasonId,
  selectedTeamId,
  toast
}) => {
  const [featureRequestDialog, setFeatureRequestDialog] = useState(null);

  const openFeatureRequestDialog = useCallback(() => {
    if (!sessionUser) {
      toast('Sign in first to send a feature request.', 'info');
      return;
    }
    const tabLabel = moduleConfig.find((item) => item.key === activeTab)?.label || 'Waterpolo Hub';
    setFeatureRequestDialog({
      subject: `Waterpolo Feature Request - ${tabLabel}`,
      message: '',
      submitting: false,
      error: ''
    });
  }, [activeTab, moduleConfig, sessionUser, toast]);

  const submitFeatureRequest = useCallback(async () => {
    if (!sessionUser || !featureRequestDialog) return;
    const subject = featureRequestDialog.subject.trim();
    const message = featureRequestDialog.message.trim();
    if (!subject || !message) {
      setFeatureRequestDialog((prev) =>
        prev ? { ...prev, error: 'Please enter both a subject and a message.' } : prev
      );
      return;
    }

    setFeatureRequestDialog((prev) => (prev ? { ...prev, submitting: true, error: '' } : prev));

    const { error } = await supabase.from('feature_requests').insert({
      user_id: sessionUser.id,
      season_id: selectedSeasonId || null,
      team_id: selectedTeamId || null,
      app: 'waterpolo',
      context_tab: activeTab,
      email: sessionUser.email || null,
      subject,
      message
    });

    if (error) {
      setFeatureRequestDialog((prev) =>
        prev
          ? {
              ...prev,
              submitting: false,
              error: error.message || 'Failed to send request.'
            }
          : prev
      );
      return;
    }

    setFeatureRequestDialog(null);
    toast('Feature request sent.', 'success');
  }, [activeTab, featureRequestDialog, selectedSeasonId, selectedTeamId, sessionUser, toast]);

  const featureRequestContext = {
    email: sessionUser?.email || 'unknown',
    activeTab,
    selectedSeasonName: selectedSeason?.name || '',
    selectedTeamName: selectedTeam?.name || ''
  };

  return {
    featureRequestDialog,
    setFeatureRequestDialog,
    openFeatureRequestDialog,
    submitFeatureRequest,
    featureRequestContext
  };
};
