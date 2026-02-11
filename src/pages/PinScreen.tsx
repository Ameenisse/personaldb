import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const VALID_PIN = "1388";

const PinScreen = () => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const { setPinUnlocked } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (pin === VALID_PIN) {
      setPinUnlocked(true);
      navigate("/");
    } else {
      setError("Wrong PIN");
      setPin("");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Person Registry</CardTitle>
          <p className="text-sm text-muted-foreground">Enter 4-digit PIN to continue</p>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <InputOTP maxLength={4} value={pin} onChange={(v) => { setPin(v); setError(""); }}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleSubmit} disabled={pin.length !== 4}>
            Unlock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PinScreen;
