"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletStore } from "@/lib/stores/wallet-store";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function AddWalletForm() {
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const add = useWalletStore((s) => s.add);

  const isValid = ADDRESS_REGEX.test(address) && label.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    add(address.trim(), label.trim());
    setAddress("");
    setLabel("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1 min-w-0">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... proxy wallet address"
          className="font-mono text-xs bg-[#111111] border-[#222]"
        />
      </div>
      <div className="w-40">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="text-xs bg-[#111111] border-[#222]"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={!isValid}
        className="shrink-0"
      >
        <Plus className="size-4" />
        Add
      </Button>
    </form>
  );
}
