package com.zeko.coordination.application;

import com.zeko.coordination.domain.FollowUpProposal;
import com.zeko.sharedkernel.domain.ResourceId;
import java.util.Optional;

public interface FollowUpRepository {
  void save(FollowUpProposal proposal);
  Optional<FollowUpProposal> findById(ResourceId proposalId);
}
