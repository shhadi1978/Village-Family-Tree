'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function MarriageNode(_props: NodeProps) {
  return (
    <div className="w-[44px] h-[44px] relative">
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ opacity: 0, width: 8, height: 8 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        style={{ opacity: 0, width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ opacity: 0, width: 8, height: 8 }}
      />

      <div className="w-full h-full rounded-full bg-gradient-to-b from-white to-rose-50 border-2 border-[#f43f5e] shadow-sm flex items-center justify-center text-base">
        <span className="animate-pulse">❤️</span>
      </div>
    </div>
  );
}

const MemoizedMarriageNode = memo(MarriageNode);
MemoizedMarriageNode.displayName = 'MarriageNode';

export default MemoizedMarriageNode;
