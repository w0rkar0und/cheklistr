import { useState } from 'react';
import { lookupVehicle } from '../../lib/vehicleLookup';
import type { VehicleInfo, DriverInfo } from '../../stores/checklistStore';
import type { User } from '../../types/database';

interface VehicleInfoStepProps {
  vehicleInfo: VehicleInfo;
  driverInfo: DriverInfo;
  profile: User;
  onChange: (info: Partial<VehicleInfo>) => void;
  onDriverChange: (info: Partial<DriverInfo>) => void;
  onNext: () => void;
}

export function VehicleInfoStep({
  vehicleInfo,
  driverInfo,
  profile,
  onChange,
  onDriverChange,
  onNext,
}: VehicleInfoStepProps) {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const canLookup = vehicleInfo.vehicleRegistration.trim().length >= 2 && !isLookingUp;

  // Require driver HR code, name, VRM, and mileage (positive integer)
  const mileageNum = parseInt(vehicleInfo.mileage, 10);
  const canProceed =
    driverInfo.hrCode.trim().length > 0 &&
    driverInfo.name.trim().length > 0 &&
    vehicleInfo.vehicleRegistration.trim().length > 0 &&
    vehicleInfo.mileage.trim().length > 0 &&
    !isNaN(mileageNum) &&
    mileageNum > 0;

  const handleLookup = async () => {
    setIsLookingUp(true);
    setLookupError(null);
    setLookupDone(false);

    const result = await lookupVehicle(vehicleInfo.vehicleRegistration);

    if (result.found && (result.make || result.model || result.colour)) {
      const makeModel = [result.make, result.model].filter(Boolean).join(' ');
      onChange({
        makeModel: makeModel || vehicleInfo.makeModel,
        colour: result.colour || vehicleInfo.colour,
      });
      setLookupDone(true);
    } else {
      setLookupError(result.error ?? 'Vehicle not found — enter details manually');
    }

    setIsLookingUp(false);
  };

  return (
    <div className="form-step">
      <h2 className="form-step-title">Vehicle Details</h2>
      <p className="form-step-description">
        Enter the van driver's details and the vehicle information before starting the inspection.
      </p>

      {/* Driver details (the person whose van is being checked) */}
      <div className="driver-fields">
        <h3 className="driver-fields-title">Van Driver</h3>

        <label htmlFor="driver-hrcode">HR Code *</label>
        <input
          id="driver-hrcode"
          type="text"
          value={driverInfo.hrCode}
          onChange={(e) => onDriverChange({ hrCode: e.target.value.toUpperCase() })}
          placeholder="e.g. X000001"
          autoCapitalize="characters"
          required
        />

        <label htmlFor="driver-name">Contractor Name *</label>
        <input
          id="driver-name"
          type="text"
          value={driverInfo.name}
          onChange={(e) => onDriverChange({ name: e.target.value })}
          placeholder="Driver's full name"
          required
        />

        <label htmlFor="driver-site">Site</label>
        <input
          id="driver-site"
          type="text"
          value={driverInfo.site}
          onChange={(e) => onDriverChange({ site: e.target.value })}
          placeholder="e.g. BHX"
        />
      </div>

      {/* Logged-in user shown as small context line */}
      <div className="inspector-info">
        Inspected by: <strong>{profile.full_name}</strong> ({profile.login_id})
      </div>

      {/* VRM with lookup button */}
      <label htmlFor="vehicle-reg">Vehicle Registration (VRM) *</label>
      <div className="vrm-lookup-row">
        <input
          id="vehicle-reg"
          type="text"
          value={vehicleInfo.vehicleRegistration}
          onChange={(e) => {
            onChange({ vehicleRegistration: e.target.value.toUpperCase() });
            if (lookupDone) setLookupDone(false);
            if (lookupError) setLookupError(null);
          }}
          placeholder="e.g. AB12 CDE"
          autoCapitalize="characters"
          required
        />
        <button
          type="button"
          className="btn-lookup"
          disabled={!canLookup}
          onClick={handleLookup}
        >
          {isLookingUp ? 'Looking up…' : 'Look up'}
        </button>
      </div>

      {lookupDone && (
        <div className="lookup-success">Vehicle details found and populated below.</div>
      )}
      {lookupError && (
        <div className="lookup-warning">{lookupError}</div>
      )}

      <label htmlFor="mileage">Mileage *</label>
      <input
        id="mileage"
        type="number"
        inputMode="numeric"
        min="1"
        value={vehicleInfo.mileage}
        onChange={(e) => onChange({ mileage: e.target.value })}
        placeholder="Current mileage"
        required
      />

      <label htmlFor="make-model">Make & Model {lookupDone && '(auto-filled)'}</label>
      <input
        id="make-model"
        type="text"
        value={vehicleInfo.makeModel}
        onChange={(e) => onChange({ makeModel: e.target.value })}
        placeholder="e.g. Ford Transit"
        readOnly={lookupDone}
        className={lookupDone ? 'input-autofilled' : ''}
      />

      <label htmlFor="colour">Colour {lookupDone && '(auto-filled)'}</label>
      <input
        id="colour"
        type="text"
        value={vehicleInfo.colour}
        onChange={(e) => onChange({ colour: e.target.value })}
        placeholder="e.g. White"
        readOnly={lookupDone}
        className={lookupDone ? 'input-autofilled' : ''}
      />

      <button
        type="button"
        className="btn-primary btn-large"
        disabled={!canProceed}
        onClick={onNext}
      >
        Continue to Photos
      </button>
    </div>
  );
}
