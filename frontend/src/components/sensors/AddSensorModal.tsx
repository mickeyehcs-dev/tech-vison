import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { sensorsApi } from '../../api/sensors';
import { useToast } from '../../context/ToastContext';
import { Cpu, Box, Wrench } from 'lucide-react';

export interface AddSensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (module: any, rawApiKey: string) => void;
}

export const AddSensorModal: React.FC<AddSensorModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [deviceName, setDeviceName] = useState('');
  const [hardwareModel, setHardwareModel] = useState('SFM-ESP32-V1');
  const [firmwareVersion, setFirmwareVersion] = useState('1.0.0');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName) {
      toast.warning('Please provide a descriptive device name');
      return;
    }

    setLoading(true);
    try {
      const result = await sensorsApi.createModule({
        device_name: deviceName,
        hardware_model: hardwareModel,
        firmware_version: firmwareVersion
      });

      toast.success('Sensor module registered successfully!');
      onSuccess(result.module, result.rawApiKey);
      onClose();
      setDeviceName('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to register sensor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register IoT Sensor Module"
      description="System will generate a unique Device ID (SFM-XXXXXXXX) and secret API key"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Device Name / Tag"
          placeholder="e.g. Smart Cooler Alpha, Truck Unit #12"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          leftIcon={<Cpu className="w-4 h-4 text-emerald-600" />}
          required
        />

        <Input
          label="Hardware Model"
          placeholder="e.g. SFM-ESP32-V1"
          value={hardwareModel}
          onChange={(e) => setHardwareModel(e.target.value)}
          leftIcon={<Box className="w-4 h-4 text-slate-400" />}
        />

        <Input
          label="Firmware Version"
          placeholder="e.g. 1.0.0"
          value={firmwareVersion}
          onChange={(e) => setFirmwareVersion(e.target.value)}
          leftIcon={<Wrench className="w-4 h-4 text-slate-400" />}
        />

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Generate & Register
          </Button>
        </div>
      </form>
    </Modal>
  );
};
