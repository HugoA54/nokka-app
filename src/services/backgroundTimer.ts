import BackgroundService from 'react-native-background-actions';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const timerTask = async (taskData: any) => {
  const { endTimeMs, duration } = taskData as { endTimeMs: number; duration: number };

  while (BackgroundService.isRunning()) {
    const remaining = Math.ceil((endTimeMs - Date.now()) / 1000);

    if (remaining <= 0) {
      // Overtime — keep updating notification until user stops
      const overtime = Math.abs(remaining);
      await BackgroundService.updateNotification({
        taskTitle: '💪 Repos terminé !',
        taskDesc: `+${formatTime(overtime)} — ouvre l'app pour stopper`,
        progressBar: { max: duration, value: 0, indeterminate: false },
      });
    } else if (remaining <= 10) {
      await BackgroundService.updateNotification({
        taskTitle: `⚠️ ${formatTime(remaining)}`,
        taskDesc: 'Bientôt fini !',
        progressBar: { max: duration, value: remaining, indeterminate: false },
      });
    } else {
      await BackgroundService.updateNotification({
        taskTitle: `⏱ ${formatTime(remaining)}`,
        taskDesc: 'Repos en cours',
        progressBar: { max: duration, value: remaining, indeterminate: false },
      });
    }

    await sleep(1000);
  }
};

export async function startBackgroundTimer(durationSeconds: number): Promise<void> {
  // Stop previous if still running
  if (BackgroundService.isRunning()) {
    await BackgroundService.stop();
  }

  const endTimeMs = Date.now() + durationSeconds * 1000;

  await BackgroundService.start(timerTask, {
    taskName: 'RestTimer',
    taskTitle: `⏱ ${formatTime(durationSeconds)}`,
    taskDesc: 'Repos en cours',
    taskIcon: { name: 'ic_launcher', type: 'mipmap' },
    color: '#c8f060',
    linkingURI: 'nokka://',
    progressBar: {
      max: durationSeconds,
      value: durationSeconds,
      indeterminate: false,
    },
    parameters: { endTimeMs, duration: durationSeconds },
  });
}

export async function stopBackgroundTimer(): Promise<void> {
  if (BackgroundService.isRunning()) {
    await BackgroundService.stop();
  }
}
